import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { EditDocs } from "@vcs/remotion";
import { RenderPlugin } from "../src/plugin.ts";

test("a plugin adds its compositions and names its own entry", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-"));
  const file = path.join(dir, "plugin.mjs");
  fs.writeFileSync(
    file,
    `export const entry = "/x/entry.tsx";
export const schemas = { Extra: { parse: (v) => { if (!v.ok) throw new Error("bad"); return v; } } };`,
  );
  assert.equal(await RenderPlugin.load(undefined), null);
  const plugin = await RenderPlugin.load(file);
  assert.equal(plugin?.entry, "/x/entry.tsx");
  assert.equal(plugin?.dir, dir);
  assert.deepEqual(EditDocs.parse("Extra", { ok: 1 }), { compositionId: "Extra", inputProps: { ok: 1 } });
  assert.throws(() => EditDocs.parse("Extra", { ok: 0 }), /bad/);
  assert.throws(() => EditDocs.parse("Missing", {}), /unknown compositionId/);
});
