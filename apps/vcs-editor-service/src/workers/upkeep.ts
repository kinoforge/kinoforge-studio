import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Lanes } from "../queue/lanes.ts";
import type { RenderQueue } from "../queue/queue.ts";
import { WorkDir } from "../queue/work.ts";
import { CacheTrim } from "../segment-cache.ts";
import { Inputs } from "./inputs.ts";

export interface CacheDir {
  dir: string;
  maxBytes: number;
}

const TEMP_PREFIXES = ["story-", "prewarm-", "render-", "remotion-"];
const LIVE_BUNDLE = "remotion-webpack-bundle-";

export class Upkeep {
  static readonly STALE_MS = 2 * Math.max(...Lanes.ALL.map((l) => l.timeoutMs));

  constructor(
    private readonly queue: RenderQueue,
    private readonly caches: CacheDir[],
  ) {}

  async sweep(signal: AbortSignal): Promise<Record<string, number>> {
    let work = 0;
    for (const id of WorkDir.ids()) {
      if (signal.aborted) break;
      const dir = WorkDir.open(id);
      if (await this.queue.live(dir)) continue;
      dir.remove();
      work++;
    }
    let parts = 0;
    for (const cache of this.caches) {
      parts += await Upkeep.removeStale(cache.dir, (name) => name.endsWith(".part.mp4"));
      await Upkeep.trim(cache, cache.maxBytes);
    }
    const temp = await Upkeep.removeStale(os.tmpdir(), (name) => !name.startsWith(LIVE_BUNDLE) && TEMP_PREFIXES.some((p) => name.startsWith(p)));
    const swept = { work, parts, temp };
    if (work || parts || temp) console.log(JSON.stringify({ sweep: swept }));
    return swept;
  }

  async doctor(signal: AbortSignal): Promise<Record<string, unknown>> {
    const ids = WorkDir.ids();
    for (const id of ids) {
      if (signal.aborted) break;
      await this.queue.heal(WorkDir.open(id));
    }
    const freeMb = await Upkeep.freeMb();
    const low = freeMb * 1024 * 1024 < 2 * Inputs.MIN_FREE_BYTES;
    if (low) for (const cache of this.caches) await Upkeep.trim(cache, Math.floor(cache.maxBytes / 2));
    const report = { free_mb: freeMb, trimmed: low, work: ids.length, queues: await this.queue.stats() };
    console.log(JSON.stringify({ doctor: report }));
    return report;
  }

  private static async freeMb(): Promise<number> {
    const stat = await fs.promises.statfs(WorkDir.root);
    return Math.round((stat.bavail * stat.bsize) / 1048576);
  }

  private static async trim(cache: CacheDir, maxBytes: number): Promise<void> {
    if (fs.existsSync(cache.dir)) await CacheTrim.keep(cache.dir, maxBytes);
  }

  private static async removeStale(dir: string, match: (name: string) => boolean): Promise<number> {
    let names: string[] = [];
    try {
      names = (await fs.promises.readdir(dir)).filter(match);
    } catch {
      return 0;
    }
    let removed = 0;
    for (const name of names) {
      const file = path.join(dir, name);
      const stat = await fs.promises.stat(file).catch(() => null);
      if (!stat || Date.now() - stat.mtimeMs < Upkeep.STALE_MS) continue;
      await fs.promises.rm(file, { recursive: true, force: true });
      removed++;
    }
    return removed;
  }
}
