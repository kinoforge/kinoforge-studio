import assert from "node:assert/strict";
import { test } from "node:test";
import { BOARD_ICONS } from "../src/animated/shared/icons/index.ts";
import { WbCamera } from "../src/animated/whiteboard/camera.ts";
import { GlyphInk } from "../src/animated/whiteboard/ink/glyph.ts";
import { PathInk, Polyline } from "../src/animated/whiteboard/ink/path.ts";
import { WbPlanner } from "../src/animated/whiteboard/plan.ts";
import { type WbFilmInput, wbFilmSchema } from "../src/animated/whiteboard/spec.ts";

const film: WbFilmInput = {
  fps: 60,
  width: 1080,
  height: 1920,
  scenes: [
    {
      seconds: 6,
      words: "a client sends a request to the server".split(" ").map((word, i) => ({ word, start: i * 0.5, end: i * 0.5 + 0.4 })),
      beats: [
        { cue: "client", piece: { type: "title", text: "Retries", kicker: "Why" } },
        { cue: "sends", piece: { type: "draw", items: [{ id: "app", picture: "phone", label: "Client" }] } },
        { cue: "server", piece: { type: "draw", items: [{ id: "api", picture: "server", label: "Server" }] } },
        { cue: "request", piece: { type: "flow", path: ["app", "api"], label: "POST" } },
      ],
    },
    {
      seconds: 5,
      beats: [
        { cue: "list", piece: { type: "list", style: "check", items: ["Same key", "Same answer"] } },
        { cue: "bars", piece: { type: "bars", items: [{ label: "A", value: 3 }, { label: "B", value: 1 }] } },
      ],
    },
  ],
};

test("a circle path measures its circumference", () => {
  const r = 50;
  const length = new Polyline(PathInk.flatten(`M${-r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`)).length;
  assert.ok(Math.abs(length - 2 * Math.PI * r) / (2 * Math.PI * r) < 0.02, String(length));
});

test("a move between subpaths draws nothing", () => {
  assert.equal(new Polyline(PathInk.flatten("M0 0L10 0M100 0L110 0")).length, 20);
});

test("packed arc flags parse", () => {
  const parts = PathInk.flatten("M0 0a5 5 0 0110 0");
  const end = parts[0][parts[0].length - 1];
  assert.ok(Math.abs(end[0] - 10) < 1e-6 && Math.abs(end[1]) < 1e-6, String(end));
});

test("kit icons give strokes", () => {
  const glyph = GlyphInk.icon(Object.values(BOARD_ICONS)[0].icon);
  assert.ok(glyph.parts.length > 0);
  for (const part of glyph.parts) assert.ok(new Polyline(PathInk.flatten(part.d)).length > 0);
});

test("a link to an item not drawn yet is refused", () => {
  const bad = structuredClone(film);
  bad.scenes[0].beats.splice(1, 0, { cue: "x", piece: { type: "link", from: "app", to: "api" } });
  assert.equal(wbFilmSchema.safeParse(bad).success, false);
});

test("the plan draws every beat inside its scene and panel", () => {
  const parsed = wbFilmSchema.parse(film);
  const plan = WbPlanner.plan(parsed);
  assert.equal(plan.seconds, 11 + WbCamera.OUTRO);
  assert.ok(plan.inks.length > 10);
  for (const ink of plan.inks) {
    const panel = plan.panels.find((p) => ink.from >= p.start && ink.from < p.end);
    if (!panel) assert.fail(`ink at ${ink.from} has no scene`);
    assert.ok(ink.to <= panel.end, `ink ends ${ink.to} after its scene ${panel.end}`);
    if (ink.kind === "line")
      for (const [x, y] of ink.path.points) {
        assert.ok(x >= panel.x && x <= panel.x + panel.w, `x ${x} outside panel`);
        assert.ok(y >= panel.y && y <= panel.y + panel.h, `y ${y} outside panel`);
      }
  }
  const second = plan.inks.filter((ink) => ink.from >= plan.panels[1].start);
  assert.ok(Math.min(...second.map((ink) => ink.from)) >= plan.panels[1].start + WbCamera.settle(1) - 1e-9);
});

test("the camera never jumps", () => {
  const plan = WbPlanner.plan(wbFilmSchema.parse(film));
  let last = WbCamera.at(0, plan.panels, 1080, 1920);
  for (let t = 1 / 60; t < plan.seconds; t += 1 / 60) {
    const view = WbCamera.at(t, plan.panels, 1080, 1920);
    assert.ok(Math.hypot(view.cx - last.cx, view.cy - last.cy) < 60, `jump at ${t}`);
    assert.ok(Math.abs(view.zoom - last.zoom) < 0.03, `zoom jump at ${t}`);
    last = view;
  }
});
