import { HandFont } from "./hand/font.ts";
import type { WbItem, WbPiece, WbPieceType, WbReserve, WbScene } from "./spec.ts";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type BlockKey = number | "diagram";

const AREA = {
  tall: { side: 0.07, top: 0.08, topCaptions: 0.2, floor: 0.92, floorCaptions: 0.8, gap: 0.03 },
  wide: { side: 0.06, top: 0.08, topCaptions: 0.2, floor: 0.93, floorCaptions: 0.8, gap: 0.04 },
};

const WEIGHTS: Record<Exclude<WbPieceType, "draw" | "link" | "flow" | "circle" | "cross">, (piece: WbPiece) => number> = {
  title: (piece) => (piece.type === "title" && piece.kicker ? 0.95 : 0.75),
  write: (piece) => 0.4 + (piece.type === "write" ? piece.text.length / 140 : 0) * 0.55,
  list: (piece) => 0.25 + (piece.type === "list" ? piece.items.length : 0) * 0.3,
  number: () => 1,
  bars: () => 1.8,
  compare: () => 1.6,
  formula: () => 0.7,
  matrix: (piece) => (piece.type === "matrix" ? 0.5 + piece.cells.length * 0.28 : 1),
  multiply: () => 2.2,
  plot: () => 2.6,
};

const DIAGRAM = new Set<WbPieceType>(["draw", "link", "flow", "circle", "cross"]);
const SIDE = new Set<WbPieceType>(["matrix", "multiply", "plot", "bars", "compare", "number"]);

export class SceneLayout {
  static area(w: number, h: number, reserve: WbReserve): Box {
    const spec = AREA[h > w ? "tall" : "wide"];
    const top = h * (reserve === "top" ? spec.topCaptions : spec.top);
    const floor = h * (reserve === "bottom" ? spec.floorCaptions : spec.floor);
    return { x: w * spec.side, y: top, w: w * (1 - 2 * spec.side), h: floor - top };
  }

  static key(scene: WbScene, beat: number): BlockKey {
    return DIAGRAM.has(scene.beats[beat].piece.type) ? "diagram" : beat;
  }

  static blocks(scene: WbScene, area: Box, tall: boolean): Map<BlockKey, Box> {
    const order: BlockKey[] = [];
    const weight = new Map<BlockKey, number>();
    scene.beats.forEach((beat, i) => {
      const key = SceneLayout.key(scene, i);
      if (weight.has(key)) return;
      order.push(key);
      const piece = beat.piece;
      weight.set(key, key === "diagram" ? (tall ? 3.0 : 2.4) : WEIGHTS[piece.type as keyof typeof WEIGHTS](piece));
    });
    const gap = area.h * (tall ? AREA.tall.gap : AREA.wide.gap);
    const out = new Map<BlockKey, Box>();
    const heads = order.filter((key) => key !== "diagram" && scene.beats[key as number].piece.type === "title");
    const rest = order.filter((key) => !heads.includes(key));
    const diagram = rest.includes("diagram");
    const columns = !diagram && rest.length > 1 && rest.length <= 3 && rest.some((key) => SIDE.has(scene.beats[key as number].piece.type));
    if (!tall && ((diagram && rest.length > 1) || columns)) {
      const top = SceneLayout.stack(heads, weight, { ...area }, gap, 3.4, false);
      const used = heads.length ? Math.max(...heads.map((key) => { const b = top.get(key) as Box; return b.y + b.h; })) - area.y + gap : 0;
      const below = { ...area, y: area.y + used, h: area.h - used };
      for (const [key, box] of top) out.set(key, box);
      if (columns) {
        const share = rest.map((key) => Math.max(weight.get(key) ?? 1, 1));
        const each = (below.w - gap * (rest.length - 1)) / share.reduce((sum, s) => sum + s, 0);
        let x = below.x;
        rest.forEach((key, i) => {
          out.set(key, { ...below, x, w: each * share[i] });
          x += each * share[i] + gap;
        });
        return out;
      }
      const split = area.w * 0.58;
      const others = rest.filter((key) => key !== "diagram");
      out.set("diagram", { ...below, w: split - gap });
      for (const [key, box] of SceneLayout.stack(others, weight, { ...below, x: below.x + split, w: below.w - split }, gap, 2))
        out.set(key, box);
      return out;
    }
    return SceneLayout.stack(order, weight, area, gap, tall ? 3.6 : 2.8);
  }

  private static stack(keys: BlockKey[], weight: Map<BlockKey, number>, area: Box, gap: number, least: number, centered = true) {
    const out = new Map<BlockKey, Box>();
    if (!keys.length) return out;
    const total = keys.reduce<number>((sum, key) => sum + (weight.get(key) ?? 1), 0);
    const unit = (area.h - gap * (keys.length - 1)) / Math.max(total, least);
    const used = unit * total + gap * (keys.length - 1);
    let y = area.y + (centered ? (area.h - used) / 2 : 0);
    for (const key of keys) {
      const h = unit * (weight.get(key) ?? 1);
      out.set(key, { x: area.x, y, w: area.w, h });
      y += h + gap;
    }
    return out;
  }
}

export interface ItemSpot {
  item: WbItem;
  cx: number;
  cy: number;
  icon: number;
  label: { size: number; lines: string[]; widths: number[]; top: number };
  box: Box;
  order: number;
}

export class DiagramLayout {
  static items(scene: WbScene): WbItem[] {
    return scene.beats.flatMap((beat) => (beat.piece.type === "draw" ? beat.piece.items : []));
  }

  static links(scene: WbScene): [string, string][] {
    const out: [string, string][] = [];
    const seen = new Set<string>();
    const add = (from: string, to: string) => {
      if (from === to) return;
      if (seen.has(`${to}>${from}`) || seen.has(`${from}>${to}`)) return;
      seen.add(`${from}>${to}`);
      out.push([from, to]);
    };
    for (const beat of scene.beats) {
      const piece = beat.piece;
      if (piece.type === "link") add(piece.from, piece.to);
      if (piece.type === "flow") for (let i = 1; i < piece.path.length; i++) add(piece.path[i - 1], piece.path[i]);
    }
    return out;
  }

  static layers(ids: string[], links: [string, string][]): Map<string, number> {
    const layer = new Map(ids.map((id) => [id, 0]));
    for (let round = 0; round < ids.length; round++) {
      let moved = false;
      for (const [from, to] of links) {
        const want = (layer.get(from) ?? 0) + 1;
        if (layer.has(to) && want > (layer.get(to) ?? 0) && want < ids.length) {
          layer.set(to, want);
          moved = true;
        }
      }
      if (!moved) break;
    }
    return layer;
  }

  static place(scene: WbScene, box: Box, tall: boolean, unit: number): Map<string, ItemSpot> {
    const items = DiagramLayout.items(scene);
    const out = new Map<string, ItemSpot>();
    if (!items.length) return out;
    const ids = items.map((item) => item.id);
    const layer = DiagramLayout.layers(ids, DiagramLayout.links(scene));
    const deepest = Math.max(...layer.values());
    const groups: string[][] = [];
    if (deepest === 0) {
      const cols = tall ? Math.min(ids.length, ids.length === 4 ? 2 : 3) : Math.min(ids.length, 4);
      ids.forEach((id, i) => {
        (groups[Math.floor(i / cols)] ??= []).push(id);
      });
    } else {
      ids.forEach((id) => {
        (groups[layer.get(id) ?? 0] ??= []).push(id);
      });
    }
    const rows = groups.filter(Boolean);
    const alongMain = deepest > 0 && !tall;
    const mainCount = rows.length;
    const crossCount = Math.max(...rows.map((row) => row.length));
    const cellW = alongMain ? box.w / mainCount : box.w / crossCount;
    const cellH = alongMain ? box.h / crossCount : box.h / mainCount;
    const zig = !alongMain && deepest > 0 && rows.filter((row) => row.length === 1).length >= 2;
    const icon = Math.min(cellW * (zig ? 0.4 : 0.56), cellH * (zig ? 0.5 : 0.42), unit * 0.27);
    const most = Math.min(Math.max(icon * 0.3, unit * 0.036), unit * 0.058);
    rows.forEach((row, r) => {
      row.forEach((id, k) => {
        const item = items.find((entry) => entry.id === id) as WbItem;
        const along = alongMain ? box.w / mainCount : box.w / row.length;
        const across = alongMain ? box.h / row.length : box.h / mainCount;
        const swing = zig && row.length === 1 ? (r % 2 ? 1 : -1) * box.w * 0.2 : 0;
        const cx = (alongMain ? box.x + (r + 0.5) * along : box.x + (k + 0.5) * along) + swing;
        const cy = alongMain ? box.y + (k + 0.5) * across : box.y + (r + 0.5) * across;
        const label = HandFont.fit(item.label, { w: cellW * 0.9, h: icon * 0.6 }, most, "regular", 2);
        const total = icon + icon * 0.12 + label.height;
        const top = cy - total / 2;
        const labelTop = top + icon + icon * 0.12;
        out.set(id, {
          item,
          cx,
          cy: top + icon / 2,
          icon,
          label: {
            size: label.size,
            lines: label.lines,
            widths: label.lines.map((line) => HandFont.width(line, label.size)),
            top: labelTop,
          },
          box: {
            x: cx - Math.max(icon, label.width) / 2,
            y: top,
            w: Math.max(icon, label.width),
            h: total,
          },
          order: out.size,
        });
      });
    });
    return out;
  }
}
