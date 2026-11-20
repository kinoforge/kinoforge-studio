import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, makeCancelSignal, renderMedia, selectComposition } from "@remotion/renderer";
import { EditDocs } from "@vcs/remotion";
import type { RenderDriver, RenderJob } from "./driver.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REMOTION_ENTRY = path.join(__dirname, "remotion-entry.ts");
// Browser tabs painting frames at once; Remotion's own default is half the cores.
const CONCURRENCY = Number(process.env.RENDER_CONCURRENCY) || null;
const WEBGL = { gl: "swangle", disableWebSecurity: true } as const;

export interface RemotionLoader {
  ensureBrowser: () => Promise<unknown>;
  bundle: (opts: { entryPoint: string }) => Promise<string>;
}

/**
 * The Remotion render backend. The only file that imports @remotion/*, so the
 * license coupling lives here alone. Bundles the project once and reuses the
 * serve URL across renders. Validates inputProps against the shared EditDoc
 * schema before encoding, so a bad shape fails fast instead of mid-render.
 */
export class RemotionDriver implements RenderDriver {
  private bundlePromise: Promise<string> | null = null;
  private built: string | null = null;

  constructor(private readonly loader: RemotionLoader = { ensureBrowser, bundle }) {}

  getBundle(): Promise<string> {
    if (this.built && RemotionDriver.gone(this.built)) {
      this.built = null;
      this.bundlePromise = null;
    }
    if (!this.bundlePromise) {
      const attempt = Promise.resolve().then(async () => {
        await this.loader.ensureBrowser();
        const built = await this.loader.bundle({ entryPoint: REMOTION_ENTRY });
        this.built = built;
        return built;
      });
      this.bundlePromise = attempt;
      attempt.catch(() => {
        if (this.bundlePromise === attempt) this.bundlePromise = null;
      });
    }
    return this.bundlePromise;
  }

  private static gone(built: string): boolean {
    return !/^https?:/.test(built) && !fs.existsSync(path.join(built, "index.html"));
  }

  async render(job: RenderJob, outputLocation: string): Promise<void> {
    const { compositionId, inputProps } = EditDocs.parse(job.compositionId, job.inputProps);
    const { cancelSignal, cancel } = makeCancelSignal();
    const stop = () => cancel();
    job.signal?.addEventListener("abort", stop, { once: true });
    try {
      job.signal?.throwIfAborted();
      const serveUrl = await this.getBundle();
      const codec = job.codec ?? "h264";
      const composition = await selectComposition({
        serveUrl,
        id: compositionId,
        inputProps,
        chromiumOptions: EditDocs.webgl(compositionId) ? WEBGL : {},
      });
      await renderMedia({
        composition,
        serveUrl,
        codec,
        concurrency: CONCURRENCY,
        x264Preset: codec === "h264" ? "veryfast" : null,
        inputProps,
        outputLocation,
        chromiumOptions: EditDocs.webgl(compositionId) ? WEBGL : {},
        metadata: job.metadata ?? null,
        cancelSignal,
      });
    } finally {
      job.signal?.removeEventListener("abort", stop);
    }
  }
}
