import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FfmpegDriver } from "../ffmpeg-driver.ts";
import { Limiter } from "../queue/local-queue.ts";
import { NoRoom, type StepContext } from "../queue/queue.ts";
import { WorkDir } from "../queue/work.ts";
import type { CaptionBody, RenderBody, RenderSpecs, StoryBody } from "../render-specs.ts";

const REMOTE = /^https?:\/\//i;

export class Inputs {
  static readonly MIN_FREE_BYTES = (Number(process.env.WORK_MIN_FREE_MB) || 1024) * 1024 * 1024;
  static readonly PARALLEL = Number(process.env.FETCH_PARALLEL) || 4;
  static readonly NO_ROOM_RETRY_MS = 30_000;

  constructor(
    private readonly specs: RenderSpecs,
    private readonly ffmpeg: FfmpegDriver,
  ) {}

  async fetch({ work, signal }: StepContext): Promise<{ files: number }> {
    await Inputs.room();
    const spec = work.spec();
    const wanted = new Map<string, string>();
    const local = (value: unknown): unknown => {
      if (typeof value !== "string" || !REMOTE.test(value) || this.loopback(value)) return value;
      const name = Inputs.name(value);
      wanted.set(name, value);
      return this.specs.media.url(this.specs.media.rel(path.join(work.inputs, name)));
    };
    const ours = (hosts: Set<string>) => (v: unknown) =>
      typeof v === "string" && Inputs.onHost(v, hosts) ? local(v) : v;
    if (spec.route === "story" || spec.route === "prewarm") {
      const b = spec.body as unknown as StoryBody;
      const props = this.specs.storyProps(b);
      const hosts = Inputs.hosts(b.uploadUrl);
      b.scenes.forEach((s, i) => {
        const pin = spec.route === "story" ? work.segment(i) : undefined;
        if (this.ffmpeg.cached(props, props.scenes[i], i, pin)) return;
        if (s.render) {
          s.render.inputProps = Inputs.walk(s.render.inputProps, ours(hosts)) as Record<string, unknown>;
          s.image = "";
          delete s.images;
        } else {
          s.image = local(s.image) as string;
          if (s.images) s.images = s.images.map((x) => local(x) as string);
        }
        if (s.video) s.video = local(s.video) as string;
        if (s.audio) s.audio = local(s.audio) as string;
      });
      if (b.music) b.music = local(b.music) as string;
      if (b.endCard?.image) b.endCard.image = local(b.endCard.image) as string;
    } else if (spec.route === "caption") {
      const b = spec.body as unknown as CaptionBody;
      b.clipRel = local(b.clipRel) as string;
    } else {
      const b = spec.body as unknown as RenderBody;
      b.inputProps = Inputs.walk(b.inputProps, ours(Inputs.hosts(b.uploadUrl))) as Record<string, unknown>;
    }
    const limiter = new Limiter(Inputs.PARALLEL);
    await Promise.all(
      [...wanted].map(([name, url]) => limiter.run(() => Inputs.download(url, path.join(work.inputs, name), signal))),
    );
    work.write("spec.json", spec);
    return { files: wanted.size };
  }

  private loopback(url: string): boolean {
    return url.startsWith(`http://127.0.0.1:${this.specs.media.port}/`);
  }

  static hosts(uploadUrl: string | undefined): Set<string> {
    const hosts = (process.env.FETCH_HOSTS || "").split(",").map((h) => h.trim()).filter(Boolean);
    if (uploadUrl && REMOTE.test(uploadUrl)) hosts.push(new URL(uploadUrl).host);
    return new Set(hosts);
  }

  static onHost(value: string, hosts: Set<string>): boolean {
    if (!REMOTE.test(value)) return false;
    try {
      return hosts.has(new URL(value).host);
    } catch {
      return false;
    }
  }

  static walk(value: unknown, map: (v: unknown) => unknown): unknown {
    if (Array.isArray(value)) return value.map((v) => Inputs.walk(v, map));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, Inputs.walk(v, map)]));
    }
    return map(value);
  }

  static name(url: string): string {
    const ext = path.extname(new URL(url).pathname).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 8);
    return createHash("sha256").update(url).digest("hex").slice(0, 32) + ext;
  }

  static async room(): Promise<void> {
    const stat = await fs.promises.statfs(WorkDir.root);
    const free = stat.bavail * stat.bsize;
    if (free < Inputs.MIN_FREE_BYTES) {
      throw new NoRoom(`only ${Math.round(free / 1048576)} MB free for render inputs`, Inputs.NO_ROOM_RETRY_MS);
    }
  }

  static async download(url: string, file: string, signal: AbortSignal): Promise<void> {
    if (fs.existsSync(file)) return;
    const res = await fetch(url, { signal });
    if (!res.ok || !res.body) throw new Error(`input ${new URL(url).pathname} answered ${res.status}`);
    const part = `${file}.${randomUUID()}.part`;
    try {
      await pipeline(Readable.fromWeb(res.body as never), fs.createWriteStream(part), { signal });
      await fs.promises.rename(part, file);
    } finally {
      await fs.promises.rm(part, { force: true });
    }
  }
}
