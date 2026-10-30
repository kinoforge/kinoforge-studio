import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import { EditDocs } from "@vcs/remotion";
import type { RenderDriver, RenderJob } from "./driver.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REMOTION_ENTRY = path.join(__dirname, "remotion-entry.ts");
// Browser tabs painting frames at once; Remotion's own default is half the cores.
const CONCURRENCY = Number(process.env.RENDER_CONCURRENCY) || null;

/**
 * The Remotion render backend. The only file that imports @remotion/*, so the
 * license coupling lives here alone. Bundles the project once and reuses the
 * serve URL across renders. Validates inputProps against the shared EditDoc
 * schema before encoding, so a bad shape fails fast instead of mid-render.
 */
export class RemotionDriver implements RenderDriver {
  private bundlePromise: Promise<string> | null = null;

  private getBundle(): Promise<string> {
    if (!this.bundlePromise) {
      this.bundlePromise = (async () => {
        await ensureBrowser();
        return bundle({ entryPoint: REMOTION_ENTRY });
      })();
    }
    return this.bundlePromise;
  }

  async render(job: RenderJob, outputLocation: string): Promise<void> {
    const { compositionId, inputProps } = EditDocs.parse(job.compositionId, job.inputProps);
    const serveUrl = await this.getBundle();
    const codec = job.codec ?? "h264";
    const composition = await selectComposition({ serveUrl, id: compositionId, inputProps });
    await renderMedia({
      composition,
      serveUrl,
      codec,
      concurrency: CONCURRENCY,
      x264Preset: codec === "h264" ? "veryfast" : null,
      inputProps,
      outputLocation,
      metadata: job.metadata ?? null,
    });
  }
}
