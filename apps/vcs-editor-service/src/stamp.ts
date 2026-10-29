import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** A digest of the code that draws: this service's drivers and the @vcs/remotion sources. A
 *  cached render made by other code is never served for the same document. */
export class RendererStamp {
  static of(): string {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const remotion = path.dirname(fileURLToPath(import.meta.resolve("@vcs/remotion")));
    const hash = createHash("sha256");
    for (const file of [here, remotion].flatMap((dir) => RendererStamp.files(dir)).sort()) {
      hash.update(file).update(fs.readFileSync(file));
    }
    return hash.digest("hex").slice(0, 16);
  }

  private static files(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return RendererStamp.files(full);
      return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
    });
  }
}
