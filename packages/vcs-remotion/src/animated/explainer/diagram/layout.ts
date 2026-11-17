import { FitText } from "../../shared/fit-text.ts";
import type { Box } from "../timeline.ts";
import type { DiagramLink } from "./spec.ts";

export interface Point {
  x: number;
  y: number;
}

interface NodeSpec {
  aspect: number;
  stretch: number;
  maxShare: number;
  mainFill: number;
  crossFill: number;
}

const NODES: Record<"tall" | "wide", NodeSpec> = {
  wide: { aspect: 1.3, stretch: 3, maxShare: 0.36, mainFill: 0.6, crossFill: 0.8 },
  tall: { aspect: 1.3, stretch: 3, maxShare: 0.26, mainFill: 0.62, crossFill: 0.82 },
};

export class DiagramInk {
  static readonly STROKE = 0.028;
  static readonly LEAST = 2.5;
  static readonly MOST = 400;
  static readonly TAG = 6;
  static readonly PAD: readonly [number, number] = [1, 2.5];
  static readonly GAP = 2;
  static readonly SPARE = 1.15;

  static stroke(unit: number): number {
    return Math.max(DiagramInk.LEAST, Math.min(unit, DiagramInk.MOST) * DiagramInk.STROKE);
  }

  static room(label: string): number {
    const tag = FitText.width(label, DiagramInk.TAG * DiagramInk.STROKE);
    const pads = (DiagramInk.PAD[1] * 2 + DiagramInk.GAP * 4) * DiagramInk.STROKE;
    return (tag + pads) * DiagramInk.SPARE;
  }

  static rise(): number {
    const tag = DiagramInk.TAG * FitText.LEADING + DiagramInk.PAD[0] * 2 + DiagramInk.GAP * 4;
    return tag * DiagramInk.STROKE * DiagramInk.SPARE;
  }
}

export interface DiagramPlacing {
  boxes: Map<string, Box>;
  wide: boolean;
}

export class DiagramLayout {
  static readonly SWITCH = 1.08;
  static readonly ROWS = 3;
  static readonly WRAP = 0.08;

  static of(order: readonly string[], links: readonly DiagramLink[], area: Box): DiagramPlacing {
    const natural = DiagramLayout.wide(area);
    if (!order.length) return { boxes: new Map(), wide: natural };
    const inside = links.filter((l) => order.includes(l.from) && order.includes(l.to));
    if (!inside.length) {
      const grid = DiagramLayout.grid(order, area, NODES[natural ? "wide" : "tall"].aspect);
      return DiagramLayout.place(grid, area, natural, 1, 0).placing;
    }
    const room = Math.max(0, ...inside.map((l) => (l.label ? DiagramInk.room(l.label) : 0)));
    const layers = DiagramLayout.layers(order, inside);
    let best: { placing: DiagramPlacing; score: number } | null = null;
    for (const wide of [natural, !natural]) {
      for (let rows = 1; rows <= Math.min(DiagramLayout.ROWS, layers.length); rows++) {
        const { placing, size } = DiagramLayout.place(layers, area, wide, rows, room);
        const cost =
          (wide === natural ? 1 : DiagramLayout.SWITCH) * (1 + DiagramLayout.WRAP * (rows - 1));
        if (!best || size / cost > best.score) best = { placing, score: size / cost };
      }
    }
    return (best as { placing: DiagramPlacing }).placing;
  }

  private static place(
    layers: readonly string[][],
    area: Box,
    wide: boolean,
    rows: number,
    room: number,
  ): { placing: DiagramPlacing; size: number } {
    const boxes = new Map<string, Box>();
    const spec = NODES[wide ? "wide" : "tall"];
    const per = Math.ceil(layers.length / rows);
    const mainLen = wide ? area.w : area.h;
    const crossLen = wide ? area.h : area.w;
    const band = crossLen / rows;
    const cellMain = mainLen / per;
    const cellCross = band / Math.max(...layers.map((layer) => layer.length));
    const tallest = wide ? cellCross * spec.crossFill : cellMain * spec.mainFill;
    const widest = wide ? cellMain * spec.mainFill : cellCross * spec.crossFill;
    let h = Math.min(tallest, widest / spec.aspect, Math.min(area.w, area.h) * spec.maxShare);
    let w = Math.min(widest, h * spec.stretch);
    const stacked = rows > 1 || layers.some((layer) => layer.length > 1);
    const sideways = wide ? per > 1 : stacked;
    const upright = wide ? stacked : per > 1;
    if (room > 0 && sideways) {
      const cell = wide ? cellMain : cellCross;
      if (cell - w < room * h) {
        w = cell - room * h;
        if (w < h * spec.aspect) {
          h = cell / (spec.aspect + room);
          w = h * spec.aspect;
        }
      }
    }
    if (room > 0 && upright) {
      const cell = wide ? cellCross : cellMain;
      const rise = DiagramInk.rise();
      if (cell - h < rise * h) {
        h = cell / (1 + rise);
        w = Math.min(w, h * spec.stretch);
      }
    }
    layers.forEach((layer, rank) => {
      const row = Math.floor(rank / per);
      const step = rank % per;
      const slot = row % 2 ? per - 1 - step : step;
      const offset = row * band + (band - layer.length * cellCross) / 2;
      layer.forEach((id, k) => {
        const main = (slot + 0.5) * cellMain;
        const cross = offset + (k + 0.5) * cellCross;
        const cx = area.x + (wide ? main : cross);
        const cy = area.y + (wide ? cross : main);
        boxes.set(id, { x: cx - w / 2, y: cy - h / 2, w, h });
      });
    });
    return { placing: { boxes, wide }, size: h };
  }

  private static layers(order: readonly string[], links: readonly DiagramLink[]): string[][] {
    const rank = new Map(order.map((id) => [id, 0]));
    const incoming = new Map(order.map((id) => [id, 0]));
    for (const link of links) incoming.set(link.to, (incoming.get(link.to) ?? 0) + 1);
    const ready = order.filter((id) => !incoming.get(id));
    const placed = new Set<string>();
    while (placed.size < order.length) {
      const id = ready.shift() ?? order.find((n) => !placed.has(n));
      if (id == null) break;
      if (placed.has(id)) continue;
      placed.add(id);
      for (const link of links) {
        if (link.from !== id || placed.has(link.to)) continue;
        rank.set(link.to, Math.max(rank.get(link.to) ?? 0, (rank.get(id) ?? 0) + 1));
        incoming.set(link.to, (incoming.get(link.to) ?? 1) - 1);
        if (!incoming.get(link.to)) ready.push(link.to);
      }
    }
    const count = Math.max(...rank.values()) + 1;
    const layers: string[][] = Array.from({ length: count }, () => []);
    for (const id of order) layers[rank.get(id) ?? 0].push(id);
    for (let r = 1; r < count; r++) {
      const before = layers[r - 1];
      const weight = (id: string) => {
        const sources = links.filter((l) => l.to === id && before.includes(l.from));
        if (!sources.length) return order.indexOf(id) / order.length + before.length;
        return sources.reduce((sum, l) => sum + before.indexOf(l.from), 0) / sources.length;
      };
      layers[r].sort((a, b) => weight(a) - weight(b) || order.indexOf(a) - order.indexOf(b));
    }
    return layers.filter((layer) => layer.length);
  }

  private static grid(order: readonly string[], area: Box, aspect: number): string[][] {
    const ratio = Math.max(area.w, area.h) / Math.min(area.w, area.h) / aspect;
    const main = Math.max(1, Math.ceil(Math.sqrt(order.length * ratio)));
    const across = Math.ceil(order.length / main);
    return Array.from({ length: main }, (_, r) => order.slice(r * across, (r + 1) * across)).filter(
      (layer) => layer.length,
    );
  }

  static wide(area: Box): boolean {
    return area.w >= area.h;
  }
}
