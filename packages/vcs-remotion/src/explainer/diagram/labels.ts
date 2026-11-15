import type { Box } from "../timeline.ts";
import type { Point } from "./layout.ts";
import type { Route } from "./route.ts";

export interface LabelSpot {
  share: number;
  side: -1 | 0 | 1;
}

export class LabelPlaces {
  static readonly SHARES = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8];
  static readonly COVER = 0.45;
  static readonly SAMPLES = [0.15, 0.35, 0.5, 0.65, 0.85];
  private readonly taken: Box[] = [];

  constructor(
    private readonly blocked: readonly Box[],
    private readonly bounds: Box,
    private readonly gap: number,
  ) {}

  arrow(route: Route, w: number, h: number): LabelSpot {
    const options: LabelSpot[] = [];
    for (const share of LabelPlaces.SHARES) {
      const { x, y } = LabelPlaces.heading(route, share);
      if (Math.abs(x) * w + Math.abs(y) * h <= route.length * LabelPlaces.COVER) {
        options.push({ share, side: 0 });
      }
      options.push({ share, side: 1 }, { share, side: -1 });
    }
    const costs = options.map((spot) => this.cost(this.box(route, spot, w, h)));
    const best = options[LabelPlaces.cheapest(costs)];
    this.taken.push(this.box(route, best, w, h));
    return best;
  }

  trip(route: Route, w: number, h: number, reach: number): -1 | 1 {
    const sides = [1, -1] as const;
    const costs = sides.map((side) =>
      LabelPlaces.SAMPLES.reduce(
        (sum, s) => sum + this.cost(LabelPlaces.around(route, s, side, w, h, reach)),
        0,
      ),
    );
    return sides[LabelPlaces.cheapest(costs)];
  }

  box(route: Route, spot: LabelSpot, w: number, h: number): Box {
    const at = LabelPlaces.at(route, spot, w, h, this.gap);
    return { x: at.x - w / 2, y: at.y - h / 2, w, h };
  }

  static at(route: Route, spot: LabelSpot, w: number, h: number, gap: number): Point {
    const at = route.at(spot.share);
    if (!spot.side) return at;
    const { x, y } = LabelPlaces.heading(route, spot.share);
    const off = (Math.abs(y) * w + Math.abs(x) * h) / 2 + gap;
    return { x: at.x - y * off * spot.side, y: at.y + x * off * spot.side };
  }

  static around(route: Route, s: number, side: -1 | 1, w: number, h: number, reach: number): Box {
    const at = route.at(s);
    const { x, y } = LabelPlaces.heading(route, s);
    const off = (Math.abs(y) * w + Math.abs(x) * h) / 2 + reach;
    const cx = at.x - y * off * side;
    const cy = at.y + x * off * side;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }

  private cost(box: Box): number {
    const hits = [...this.blocked, ...this.taken].reduce(
      (sum, other) => sum + LabelPlaces.overlap(box, other),
      0,
    );
    return hits + box.w * box.h - LabelPlaces.overlap(box, this.bounds);
  }

  private static heading(route: Route, share: number): Point {
    const ahead = route.at(Math.min(1, share + 0.02));
    const back = route.at(Math.max(0, share - 0.02));
    const run = Math.hypot(ahead.x - back.x, ahead.y - back.y) || 1;
    return { x: (ahead.x - back.x) / run, y: (ahead.y - back.y) / run };
  }

  private static cheapest(costs: readonly number[]): number {
    const free = costs.findIndex((cost) => cost < 1);
    if (free >= 0) return free;
    return costs.reduce((best, cost, i) => (cost < costs[best] ? i : best), 0);
  }

  private static overlap(a: Box, b: Box): number {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
  }
}
