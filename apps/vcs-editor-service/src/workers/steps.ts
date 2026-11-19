import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import type { StoryVideoProps } from "@vcs/remotion";
import type { RenderDriver } from "../driver.ts";
import type { FfmpegDriver } from "../ffmpeg-driver.ts";
import { Failure, type Outcome, type StepContext } from "../queue/queue.ts";
import type { WorkDir } from "../queue/work.ts";
import type { RenderSpecs, StoryBody } from "../render-specs.ts";

export class Steps {
  static readonly PUT_IDLE_MS = Number(process.env.UPLOAD_IDLE_TIMEOUT_MS) || 120_000;
  static START_RETRY_MS = [500, 1500];
  private static readonly notifying = new Set<string>();

  constructor(
    private readonly specs: RenderSpecs,
    private readonly driver: RenderDriver,
    private readonly ffmpeg: FfmpegDriver,
  ) {}

  async render({ work, signal, part }: StepContext): Promise<{ skipped?: boolean }> {
    const spec = work.spec();
    if (part === undefined) {
      Steps.started(work, spec.body.callbackUrl, signal, "started");
      await Steps.into(work.out, (out) => this.driver.render({ ...this.specs.job(spec, work), signal }, out));
      return {};
    }
    const props = this.specs.storyProps(spec.body as unknown as StoryBody);
    if (
      fs.existsSync(work.segment(part)) ||
      this.ffmpeg.cached(props, props.scenes[part], part, work.segment(part)) ||
      fs.existsSync(work.part(part))
    ) {
      return { skipped: true };
    }
    try {
      await Steps.into(work.part(part), (out) => this.driver.render({ ...this.specs.part(spec, part), signal }, out));
    } catch (e) {
      throw new Error(`scene ${part + 1}: ${Failure.text(e)}`);
    }
    return {};
  }

  private static async into(file: string, make: (out: string) => Promise<unknown>): Promise<void> {
    const part = `${file}.part.mp4`;
    try {
      await make(part);
      await fs.promises.rename(part, file);
    } catch (e) {
      await fs.promises.rm(part, { force: true }).catch(() => undefined);
      throw e;
    }
  }

  async prewarm({ work, signal }: StepContext): Promise<void> {
    const props = this.specs.storyProps(work.spec().body as unknown as StoryBody);
    await this.ffmpeg.prewarm(props as StoryVideoProps, signal);
  }

  async upload({ work, signal }: StepContext): Promise<{ file: string }> {
    signal.throwIfAborted();
    const spec = work.spec();
    Steps.started(work, spec.body.callbackUrl, signal, "started-upload");
    const target = this.specs.target(spec, work);
    const uploadUrl = spec.body.uploadUrl;
    if (typeof uploadUrl === "string" && uploadUrl) {
      await Steps.put(uploadUrl, work.out, signal);
    } else {
      await fs.promises.mkdir(target.dir, { recursive: true });
      await fs.promises.copyFile(work.out, path.join(target.dir, target.name));
    }
    const made = { file: target.file };
    work.write("made.json", made);
    return made;
  }

  async finish({ work, error, signal, keepWork }: StepContext): Promise<Outcome> {
    const outcome: Outcome =
      error !== undefined
        ? { ok: false, error }
        : work.has("made.json")
          ? { ok: true, ...(work.read("made.json") as { file: string }) }
          : { ok: true };
    const callbackUrl = work.exists ? work.spec().body.callbackUrl : undefined;
    if (typeof callbackUrl === "string" && callbackUrl) await Steps.callBack(callbackUrl, outcome, signal);
    if (!keepWork) work.remove();
    return outcome;
  }

  private static started(work: WorkDir, url: unknown, signal: AbortSignal, tag = "started"): void {
    if (typeof url !== "string" || !url || work.has(tag)) return;
    const key = `${work.id}:${tag}`;
    if (Steps.notifying.has(key)) return;
    Steps.notifying.add(key);
    void (async () => {
      try {
        for (let attempt = 0; ; attempt++) {
          if (signal.aborted || !work.exists || work.has(tag)) return;
          try {
            await Steps.callBack(url, { started: true }, signal);
            if (work.exists) work.claim(tag);
            return;
          } catch (e) {
            const delay = Steps.START_RETRY_MS[attempt];
            if (delay === undefined || signal.aborted) {
              console.warn(`render ${work.id} start notice failed: ${Failure.text(e)}`);
              return;
            }
            await new Promise<void>((resolve) => {
              const onAbort = () => {
                clearTimeout(timer);
                resolve();
              };
              const timer = setTimeout(() => {
                signal.removeEventListener("abort", onAbort);
                resolve();
              }, delay);
              signal.addEventListener("abort", onAbort, { once: true });
            });
          }
        }
      } finally {
        Steps.notifying.delete(key);
      }
    })();
  }

  static async callBack(url: string, outcome: Outcome | { started: true }, signal: AbortSignal): Promise<void> {
    const res = await fetch(url, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(outcome),
    });
    if (res.ok || (res.status >= 400 && res.status < 500)) return;
    throw new Error(`render callback answered ${res.status}`);
  }

  static async put(
    url: string,
    file: string,
    signal?: AbortSignal,
    idleTimeoutMs = Steps.PUT_IDLE_MS,
  ): Promise<void> {
    signal?.throwIfAborted();
    const { size } = await fs.promises.stat(file);
    signal?.throwIfAborted();
    const target = new URL(url);
    const send = target.protocol === "https:" ? https.request : http.request;
    await new Promise<void>((resolve, reject) => {
      let done = false;
      let stream: fs.ReadStream | undefined;
      let req: http.ClientRequest | undefined;
      const finish = (err?: unknown) => {
        if (done) return;
        done = true;
        signal?.removeEventListener("abort", onAbort);
        if (err) {
          stream?.destroy();
          req?.destroy();
          reject(err);
        } else {
          resolve();
        }
      };
      const onAbort = () => finish(signal?.reason ?? new Error("assets upload aborted"));
      signal?.addEventListener("abort", onAbort, { once: true });

      req = send(
        target,
        {
          method: "PUT",
          signal,
          timeout: idleTimeoutMs,
          headers: { "Content-Type": "video/mp4", "Content-Length": size },
        },
        (res) => {
          let text = "";
          res.setEncoding("utf8");
          res.on("data", (chunk: string) => {
            if (text.length < 200) text += chunk;
          });
          res.on("error", finish);
          res.on("aborted", () => finish(new Error("assets upload aborted")));
          res.on("end", () => {
            const status = res.statusCode ?? 0;
            if (status >= 200 && status < 300) finish();
            else finish(new Error(`assets upload ${status}: ${text.slice(0, 200)}`));
          });
        },
      );
      req.on("timeout", () => finish(new Error(`assets upload timed out after ${idleTimeoutMs}ms`)));
      req.on("error", finish);
      stream = fs.createReadStream(file);
      stream.on("error", finish);
      stream.pipe(req);
    });
  }
}
