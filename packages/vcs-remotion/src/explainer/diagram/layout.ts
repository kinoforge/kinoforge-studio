import type { Box } from "../timeline.ts";
import type { DiagramLink } from "./spec.ts";

export interface Point {
  x: number;
  y: number;
}

/** One frame shape's diagram proportions: a node's width to its height, its largest share of
 *  the area's short side, and how much of its cell it fills. */
interface NodeSpec {
  aspect: number;
  maxShare: number;
  mainFill: number;
  crossFill: number;
}

const NODES: Record<"tall" | "wide", NodeSpec> = {
  wide: { aspect: 1.3, maxShare: 0.36, mainFill: 0.6, crossFill: 0.8 },
  tall: { aspect: 1.3, maxShare: 0.26, mainFill: 0.62, crossFill: 0.82 },
};

export interface DiagramPlacing {
  boxes: Map<string, Box>;
  wide: boolean;
}

/** Where every node of a diagram stands, worked out from its arrows: layers along one side of
 *  the area (sources first), the nodes of a layer spread across it in the order their sources
 *  hold. A diagram without arrows is a grid. The writer never places anything. */
export class DiagramLayout {
  static readonly SWITCH = 1.08;

  static of(order: readonly string[], links: readonly DiagramLink[], area: Box): DiagramPlacing {
    const natural = DiagramLayout.wide(area);
    if (!order.length) return { boxes: new Map(), wide: natural };
    const inside = links.filter((l) => order.includes(l.from) && order.includes(l.to));
    if (!inside.length) {
      const grid = DiagramLayout.grid(order, area, NODES[natural ? "wide" : "tall"].aspect);
      return DiagramLayout.place(grid, area, natural).placing;
    }
    const layers = DiagramLayout.layers(order, inside);
    const own = DiagramLayout.place(layers, area, natural);
    const turned = DiagramLayout.place(layers, area, !natural);
    return turned.size > own.size * DiagramLayout.SWITCH ? turned.placing : own.placing;
  }

  private static place(
    layers: readonly string[][],
    area: Box,
    wide: boolean,
  ): { placing: DiagramPlacing; size: number } {
    const boxes = new Map<string, Box>();
    const spec = NODES[wide ? "wide" : "tall"];
    const mainLen = wide ? area.w : area.h;
    const crossLen = wide ? area.h : area.w;
    const cellMain = mainLen / layers.length;
    const cellCross = crossLen / Math.max(...layers.map((layer) => layer.length));
    const tallest = wide ? cellCross * spec.crossFill : cellMain * spec.mainFill;
    const widest = wide ? cellMain * spec.mainFill : cellCross * spec.crossFill;
    const h = Math.min(tallest, widest / spec.aspect, Math.min(area.w, area.h) * spec.maxShare);
    const w = h * spec.aspect;
    layers.forEach((layer, rank) => {
      const offset = (crossLen - layer.length * cellCross) / 2;
      layer.forEach((id, k) => {
        const main = (rank + 0.5) * cellMain;
        const cross = offset + (k + 0.5) * cellCross;
        const cx = area.x + (wide ? main : cross);
        const cy = area.y + (wide ? cross : main);
        boxes.set(id, { x: cx - w / 2, y: cy - h / 2, w, h });
      });
    });
    return { placing: { boxes, wide }, size: h };
  }

  /** Longest-path layers; a node in a loop keeps the layer its first sources give it. */
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

  /** Nodes no arrow links yet, as layers of a near-square grid. */
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
