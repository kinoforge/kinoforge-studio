import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import type { StoryVideoProps } from "@vcs/remotion";
import type { RenderDriver } from "../driver.ts";
import type { FfmpegDriver } from "../ffmpeg-driver.ts";
import type { Outcome, StepContext } from "../queue/queue.ts";
import type { RenderSpecs, StoryBody } from "../render-specs.ts";

export class Steps {
  constructor(
    private readonly specs: RenderSpecs,
    private readonly driver: RenderDriver,
    private readonly ffmpeg: FfmpegDriver,
  ) {}

  async render({ work, signal }: StepContext): Promise<void> {
    const part = `${work.out}.part.mp4`;
    await this.driver.render({ ...this.specs.job(work.spec()), signal }, part);
    await fs.promises.rename(part, work.out);
  }

  async prewarm({ work }: StepContext): Promise<void> {
    const props = this.specs.storyProps(work.spec().body as unknown as StoryBody);
    await this.ffmpeg.prewarm(props as StoryVideoProps);
  }

  async upload({ work }: StepContext): Promise<{ file: string }> {
    const spec = work.spec();
    const target = this.specs.target(spec);
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

  static async callBack(url: string, outcome: Outcome, signal: AbortSignal): Promise<void> {
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
