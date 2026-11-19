import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { STORY_COMPOSITION_ID } from "@vcs/remotion";
import type { RenderDriver, RenderJob } from "./driver.ts";
import { WorkDir } from "./queue/work.ts";
import { CacheTrim } from "./segment-cache.ts";

const WORK_INPUT_URL = /^https?:\/\/127\.0\.0\.1:\d+\/media\/(work\/[0-9a-f-]{36}\/in\/.+)$/;

/** Stable-stringify: object keys sorted so equal jobs hash equal regardless of key order. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

function fileDigest(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function normalizeInputs(
  value: unknown,
  mediaRoot: string,
  seen: Map<string, Promise<string>>,
): Promise<unknown> {
  if (typeof value === "string") {
    const match = WORK_INPUT_URL.exec(value);
    if (!match || !mediaRoot) return value;
    try {
      const rel = match[1].split("/").map(decodeURIComponent).join("/");
      const root = path.resolve(mediaRoot);
      const resolved = path.resolve(root, rel);
      if (!resolved.startsWith(root + path.sep)) return value;
      let pending = seen.get(resolved);
      if (!pending) {
        pending = fileDigest(resolved);
        seen.set(resolved, pending);
      }
      const digest = await pending;
      return `work-in-sha256:${digest}${path.extname(resolved).toLowerCase()}`;
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((v) => normalizeInputs(v, mediaRoot, seen)));
  }
  if (value && typeof value === "object") {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(async ([k, v]) => [
        k,
        await normalizeInputs(v, mediaRoot, seen),
      ]),
    );
    return Object.fromEntries(entries);
  }
  return value;
}

async function jobHash(job: RenderJob, stamp: string, mediaRoot: string): Promise<string> {
  const inputProps = await normalizeInputs(job.inputProps, mediaRoot, new Map());
  const key = stableStringify({
    s: stamp,
    c: job.compositionId,
    i: inputProps,
    k: job.codec ?? "h264",
    m: job.metadata,
  });
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Content-addressed render cache decorator. The output of a deterministic
 * composition depends only on (compositionId, inputProps, codec) and the code
 * that draws it (`stamp`), so an identical job re-uses the cached mp4 instead of
 * re-encoding. Wraps any driver, the cache survives swapping the Remotion
 * backend for another.
 */
export class CachingDriver implements RenderDriver {
  constructor(
    private readonly inner: RenderDriver,
    private readonly cacheDir: string,
    private readonly stamp: string,
    private readonly maxBytes: number,
    private readonly outputDir?: string,
  ) {}

  async render(job: RenderJob, outputLocation: string): Promise<void> {
    // A story's media arrive as signed urls that differ each time; its scenes are kept by
    // their content instead (SegmentCache).
    if (job.compositionId === STORY_COMPOSITION_ID) return this.inner.render(job, outputLocation);
    const mediaRoot = this.outputDir ?? (WorkDir.root ? path.dirname(WorkDir.root) : "");
    const cachePath = path.join(this.cacheDir, `${await jobHash(job, this.stamp, mediaRoot)}.mp4`);
    if (fs.existsSync(cachePath)) {
      try {
        const now = new Date();
        await fs.promises.utimes(cachePath, now, now).catch(() => undefined);
        await fs.promises.mkdir(path.dirname(outputLocation), { recursive: true });
        await fs.promises.copyFile(cachePath, outputLocation);
        return;
      } catch {
      }
    }
    await this.inner.render(job, outputLocation);
    const part = `${cachePath}.${randomUUID()}.part.mp4`;
    try {
      await fs.promises.mkdir(this.cacheDir, { recursive: true });
      await fs.promises.copyFile(outputLocation, part);
      await fs.promises.rename(part, cachePath);
      await CacheTrim.keep(this.cacheDir, this.maxBytes);
    } catch {
      // A cache write failure must never fail the render the caller already has.
    } finally {
      await fs.promises.rm(part, { force: true }).catch(() => undefined);
    }
  }
}
