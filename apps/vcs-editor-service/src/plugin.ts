import path from "node:path";
import { pathToFileURL } from "node:url";
import { EditDocs } from "@vcs/remotion";

export class RenderPlugin {
  constructor(
    readonly entry: string,
    readonly dir: string,
  ) {}

  static async load(file: string | undefined): Promise<RenderPlugin | null> {
    if (!file) return null;
    const mod = (await import(pathToFileURL(path.resolve(file)).href)) as {
      entry: string;
      schemas: Parameters<typeof EditDocs.extend>[0];
    };
    EditDocs.extend(mod.schemas);
    return new RenderPlugin(mod.entry, path.dirname(path.resolve(file)));
  }
}
