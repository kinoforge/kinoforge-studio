import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Story scenes rendered once and kept by what they are made of, so a film assembled again,
 * or assembled after its scenes were rendered ahead, only renders the scenes that changed.
 * A scene asked for while it is being rendered waits for that render instead of starting
 * another. The oldest scenes go once the cache holds more than its limit.
 */
export class SegmentCache {
  private readonly making = new Map<string, Promise<string>>();

  constructor(
    private readonly dir: string,
    private readonly maxBytes: number,
  ) {}

  /** The scene's file: kept, being made, or made now by `make` into the path it is given. */
  get(hash: string, make: (out: string) => Promise<void>): Promise<string> {
    const kept = path.join(this.dir, `${hash}.mp4`);
    if (fs.existsSync(kept)) {
      const now = new Date();
      fs.promises.utimes(kept, now, now).catch(() => undefined);
      return Promise.resolve(kept);
    }
    const running = this.making.get(hash);
    if (running) return running;
    const made = this.make(kept, make).finally(() => this.making.delete(hash));
    this.making.set(hash, made);
    return made;
  }

  private async make(kept: string, make: (out: string) => Promise<void>): Promise<string> {
    await fs.promises.mkdir(this.dir, { recursive: true });
    const part = `${kept}.${randomUUID()}.part.mp4`;
    try {
      await make(part);
      await fs.promises.rename(part, kept);
    } finally {
      await fs.promises.rm(part, { force: true });
    }
    await CacheTrim.keep(this.dir, this.maxBytes).catch(() => undefined);
    return kept;
  }
}

/** Holds a cache folder to its size: the files used longest ago go first. */
export class CacheTrim {
  static async keep(dir: string, maxBytes: number): Promise<void> {
    const names = (await fs.promises.readdir(dir)).filter((n) => /^[0-9a-f]+\.mp4$/.test(n));
    const files = await Promise.all(
      names.map(async (name) => {
        const file = path.join(dir, name);
        const stat = await fs.promises.stat(file);
        return { file, size: stat.size, used: stat.mtimeMs };
      }),
    );
    let total = files.reduce((sum, f) => sum + f.size, 0);
    for (const f of files.sort((a, b) => a.used - b.used)) {
      if (total <= maxBytes) break;
      await fs.promises.rm(f.file, { force: true });
      total -= f.size;
    }
  }
}
