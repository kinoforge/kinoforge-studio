import assert from "node:assert/strict";
import { test } from "node:test";
import { BOARD_ICONS } from "../src/animated/shared/icons/index.ts";
import { WbCamera } from "../src/animated/whiteboard/camera.ts";
import { GlyphInk } from "../src/animated/whiteboard/ink/glyph.ts";
import { PathInk, Polyline } from "../src/animated/whiteboard/ink/path.ts";
import { WbPlanner } from "../src/animated/whiteboard/plan.ts";
import { WhiteboardKit } from "../src/animated/whiteboard/kit.ts";
import { WB_PIECES, type WbFilmInput, wbFilmSchema, wbPieceSchema } from "../src/animated/whiteboard/spec.ts";

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

test("multiply writes the real product and lights one row and column at a time", () => {
  const parsed = wbFilmSchema.parse({
    fps: 60,
    width: 1080,
    height: 1920,
    scenes: [{ seconds: 12, beats: [{ cue: "times", piece: { type: "multiply", a: [[1, 2], [3, 4]], b: [[5, 6], [7, 8]] } }] }],
  });
  const texts = WbPlanner.plan(parsed).inks.flatMap((ink) => (ink.kind === "text" ? ink.lines : []));
  for (const value of ["19", "22", "43", "50", "1×5 + 2×7 = 19"]) assert.ok(texts.includes(value), value);
  const lit = WbPlanner.plan(parsed).inks.filter((ink) => ink.off != null);
  assert.equal(lit.length, 8);
  for (const ink of lit) assert.ok((ink.off as number) >= ink.from);
});

test("multiply refuses shapes that cannot multiply", () => {
  const scene = { seconds: 5, beats: [{ cue: "x", piece: { type: "multiply", a: [[1, 2]], b: [[1, 2]] } }] };
  assert.equal(wbFilmSchema.safeParse({ fps: 60, width: 1080, height: 1920, scenes: [scene] }).success, false);
});

test("the kit describes every piece and checks a film the way the renderer parses it", () => {
  const kit = WhiteboardKit.describe();
  assert.deepEqual(kit.pieces.map((piece) => piece.type).sort(), Object.keys(WB_PIECES).sort());
  for (const piece of kit.pieces) {
    assert.ok(piece.fields.length > 0, piece.type);
    assert.ok(wbPieceSchema.safeParse(piece.example).success, piece.type);
  }
  assert.deepEqual(WhiteboardKit.check(film), []);
  const scene = { seconds: 5, beats: [{ piece: { type: "link", from: "a", to: "b" } }] };
  assert.ok(WhiteboardKit.check({ ...film, scenes: [scene] }).some((problem) => problem.includes("not drawn")));
});

test("a beat with its own voice starts when that voice starts", () => {
  const parsed = wbFilmSchema.parse({
    fps: 60,
    width: 1080,
    height: 1920,
    scenes: [
      { seconds: 4, beats: [{ at: 0.5, voice: "a.mp3", piece: { type: "title", text: "One" } }] },
      { seconds: 8, beats: [{ at: 1, voice: "b.mp3", piece: { type: "write", text: "Two" } }, { at: 4.5, voice: "c.mp3", piece: { type: "formula", text: "x = 3" } }] },
    ],
  });
  const plan = WbPlanner.plan(parsed);
  assert.deepEqual(plan.voices, [{ start: 0.5, src: "a.mp3" }, { start: 5, src: "b.mp3" }, { start: 8.5, src: "c.mp3" }]);
  const firsts = [...new Set(plan.inks.map((ink) => ink.from))].sort((a, b) => a - b);
  for (const at of [0.5, 5, 8.5]) assert.ok(firsts.some((from) => Math.abs(from - at) < 1e-6), String(at));
});

test("a wide scene keeps its title at the top and gives the side pieces the room below", async () => {
  const { SceneLayout } = await import("../src/animated/whiteboard/layout.ts");
  const film = wbFilmSchema.parse({
    fps: 30,
    width: 1920,
    height: 1080,
    scenes: [
      {
        seconds: 20,
        beats: [
          { piece: { type: "title", text: "House prices", kicker: "An example" } },
          { piece: { type: "draw", items: [{ id: "a", label: "House", picture: "home" }] } },
          { piece: { type: "formula", text: "(300 - 250)^2 = 2500" } },
          { piece: { type: "bars", items: [{ label: "Small", value: 4 }, { label: "Big", value: 25 }] } },
          { piece: { type: "list", style: "number", items: ["One", "Two", "Three"] } },
        ],
      },
    ],
  });
  const area = SceneLayout.area(1920, 1080, film.reserve);
  const blocks = SceneLayout.blocks(film.scenes[0], area, false);
  assert.equal(blocks.get(0)?.y, area.y);
  const side = [2, 3, 4].reduce((sum, key) => sum + (blocks.get(key)?.h ?? 0), 0);
  assert.ok(side > area.h * 0.55, `side pieces get ${side} of ${area.h}`);
});

const plotted = (piece: object) =>
  WbPlanner.plan(
    wbFilmSchema.parse({ fps: 60, width: 1920, height: 1080, scenes: [{ seconds: 14, beats: [{ at: 0.5, piece }] }] }),
  );

test("a plot rolls the ball down its curve to the lowest point and leaves it there", () => {
  const plan = plotted({ type: "plot", x: "weight", y: "loss", curve: { points: [[-3, 9], [-1, 1], [0, 0.2], [1, 1], [3, 9]], label: "loss", roll: true } });
  const ball = plan.inks.find((ink) => ink.kind === "dot");
  assert.ok(ball && ball.kind === "dot");
  const curve = plan.inks.find((ink) => ink.kind === "line" && ink.width > 0 && ink.path.length > 0 && ink.color === "#2457c5");
  assert.ok(curve && curve.kind === "line");
  const lowest = Math.max(...Array.from({ length: 101 }, (_, i) => curve.path.point(i / 100)[1]));
  const [, endY] = ball.path.point(1);
  assert.ok(Math.abs(endY + ball.r - lowest) < 2, `ball ends at ${endY + ball.r}, curve bottom ${lowest}`);
  const rest = plan.inks.filter((ink) => ink.kind === "fill" && ink.from >= ball.to - 1e-6);
  assert.equal(rest.length, 1);
  const texts = plan.inks.flatMap((ink) => (ink.kind === "text" ? ink.lines : []));
  for (const word of ["weight", "loss"]) assert.ok(texts.includes(word), word);
});

test("a transform bends the grid inside the plot and names where i and j land", () => {
  const plan = plotted({ type: "plot", transform: [[2, 1], [1, 3]] });
  const texts = plan.inks.flatMap((ink) => (ink.kind === "text" ? ink.lines : []));
  for (const label of ["i", "j", "(2, 1)", "(1, 3)"]) assert.ok(texts.includes(label), label);
  const grid = plan.inks.find((ink) => ink.kind === "line" && ink.color === "#2457c5");
  assert.ok(grid && grid.kind === "line");
  const faint = plan.inks.find((ink) => ink.kind === "line" && ink.color === "#bfe0ff");
  assert.ok(faint && faint.kind === "line");
  const edge = Array.from({ length: 2001 }, (_, i) => faint.path.point(i / 2000));
  const xs = edge.map(([x]) => x);
  const ys = edge.map(([, y]) => y);
  const [lx, hx, ly, hy] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (let i = 0; i <= 50; i++) {
    const [x, y] = grid.path.point(i / 50);
    assert.ok(x >= lx - 2 && x <= hx + 2 && y >= ly - 2 && y <= hy + 2, `grid point ${x},${y} outside`);
  }
});

test("plot vectors carry their coordinates and an empty plot is refused", () => {
  const plan = plotted({ type: "plot", vectors: [{ to: [3, 2] }, { to: [-1, 2], label: "b" }] });
  const texts = plan.inks.flatMap((ink) => (ink.kind === "text" ? ink.lines : []));
  for (const label of ["(3, 2)", "b"]) assert.ok(texts.includes(label), label);
  assert.equal(wbPieceSchema.safeParse({ type: "plot", x: "time" }).success, false);
});
