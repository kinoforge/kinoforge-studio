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
  constructor(
    private readonly specs: RenderSpecs,
    private readonly driver: RenderDriver,
    private readonly ffmpeg: FfmpegDriver,
  ) {}

  async render({ work, signal, part }: StepContext): Promise<{ skipped?: boolean }> {
    const spec = work.spec();
    Steps.started(work, spec.body.callbackUrl, signal);
    if (part === undefined) {
      await Steps.into(work.out, (out) => this.driver.render({ ...this.specs.job(spec, work), signal }, out));
      return {};
    }
    const props = this.specs.storyProps(spec.body as unknown as StoryBody);
    if (this.ffmpeg.cached(props, props.scenes[part], part) || fs.existsSync(work.part(part))) {
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
    await make(part);
    await fs.promises.rename(part, file);
  }

  async prewarm({ work }: StepContext): Promise<void> {
    const props = this.specs.storyProps(work.spec().body as unknown as StoryBody);
    await this.ffmpeg.prewarm(props as StoryVideoProps);
  }

  async upload({ work }: StepContext): Promise<{ file: string }> {
    const spec = work.spec();
    const target = this.specs.target(spec, work);
    const uploadUrl = spec.body.uploadUrl;
    if (typeof uploadUrl === "string" && uploadUrl) {
      await Steps.put(uploadUrl, work.out);
    } else {
      await fs.promises.mkdir(target.dir, { recursive: true });
      await fs.promises.copyFile(work.out, path.join(target.dir, target.name));
    }
    const made = { file: target.file };
    work.write("made.json", made);
    return made;
  }

  async finish({ work, error, signal }: StepContext): Promise<Outcome> {
    const outcome: Outcome =
      error !== undefined
        ? { ok: false, error }
        : work.has("made.json")
          ? { ok: true, ...(work.read("made.json") as { file: string }) }
          : { ok: true };
    const callbackUrl = work.exists ? work.spec().body.callbackUrl : undefined;
    if (typeof callbackUrl === "string" && callbackUrl) await Steps.callBack(callbackUrl, outcome, signal);
    work.remove();
    return outcome;
  }

  private static started(work: WorkDir, url: unknown, signal: AbortSignal): void {
    if (typeof url !== "string" || !url || !work.claim("started")) return;
    Steps.callBack(url, { started: true }, signal).catch((e) =>
      console.warn(`render ${work.id} start notice failed: ${Failure.text(e)}`),
    );
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

  static async put(url: string, file: string): Promise<void> {
    const { size } = await fs.promises.stat(file);
    const target = new URL(url);
    const send = target.protocol === "https:" ? https.request : http.request;
    await new Promise<void>((resolve, reject) => {
      const req = send(
        target,
        { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Length": size } },
        (res) => {
          let text = "";
          res.setEncoding("utf8");
          res.on("data", (chunk: string) => {
            if (text.length < 200) text += chunk;
          });
          res.on("end", () => {
            const status = res.statusCode ?? 0;
            if (status >= 200 && status < 300) resolve();
            else reject(new Error(`assets upload ${status}: ${text.slice(0, 200)}`));
          });
        },
      );
      req.on("error", reject);
      fs.createReadStream(file).on("error", reject).pipe(req);
    });
  }
}
