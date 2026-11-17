import { Ease } from "../../shared/ease.ts";
import type { Box } from "../timeline.ts";
import type { Point } from "./layout.ts";
import type { DiagramLink } from "./spec.ts";
import { Links } from "./state.ts";

export class Route {
  static readonly SAMPLES = 48;
  private readonly marks: number[] = [0];

  constructor(readonly points: readonly Point[]) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      this.marks.push(this.marks[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
  }

  get length(): number {
    return this.marks.at(-1) ?? 0;
  }

  at(share: number): Point {
    const goal = Ease.clamp(share) * this.length;
    let i = 1;
    while (i < this.points.length - 1 && this.marks[i] < goal) i++;
    const a = this.points[i - 1];
    const b = this.points[i] ?? a;
    const piece = this.marks[i] - this.marks[i - 1];
    const f = piece > 0 ? (goal - this.marks[i - 1]) / piece : 0;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  until(share: number): Point[] {
    const goal = Ease.clamp(share) * this.length;
    const out = [this.points[0]];
    for (let i = 1; i < this.points.length && this.marks[i] < goal; i++) out.push(this.points[i]);
    out.push(this.at(share));
    return out;
  }

  static blend(a: Route, b: Route, p: number): Route {
    const points = Array.from({ length: Route.SAMPLES + 1 }, (_, k) => {
      const from = a.at(k / Route.SAMPLES);
      const to = b.at(k / Route.SAMPLES);
      return { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p };
    });
    return new Route(points);
  }
}

interface Extent {
  m0: number;
  m1: number;
  c0: number;
  c1: number;
}

interface Layer {
  m0: number;
  m1: number;
  ids: string[];
}

type Side = "after" | "before" | "low" | "high";

interface Lane {
  enter: number;
  exit: number;
  c: number;
}

interface Plan {
  key: string;
  from: string;
  to: string;
  out: Side;
  in: Side;
  lanes: Lane[];
  bulge: number;
}

export class DiagramRoutes {
  static readonly CURVE = 14;

  private readonly extents = new Map<string, Extent>();
  private readonly layers: Layer[] = [];
  private readonly layerOf = new Map<string, number>();
  private readonly ports = new Map<string, number>();
  private readonly used = new Map<string, number>();

  private constructor(
    boxes: ReadonlyMap<string, Box>,
    private readonly wide: boolean,
    private readonly gap: number,
  ) {
    for (const [id, box] of boxes) this.extents.set(id, this.extent(box));
    const ids = [...this.extents.keys()].sort((a, b) => this.mid(a) - this.mid(b));
    const thin = Math.min(...ids.map((id) => this.size(id, "m")));
    for (const id of ids) {
      const last = this.layers.at(-1);
      const open = last && this.mid(id) - this.mid(last.ids[0]) < thin * 0.5;
      const layer = open ? last : { m0: Infinity, m1: -Infinity, ids: [] };
      if (!open) this.layers.push(layer);
      const e = this.extents.get(id) as Extent;
      layer.ids.push(id);
      layer.m0 = Math.min(layer.m0, e.m0);
      layer.m1 = Math.max(layer.m1, e.m1);
    }
    this.layers.forEach((layer, k) => {
      layer.ids.sort((a, b) => this.cross(a) - this.cross(b));
      for (const id of layer.ids) this.layerOf.set(id, k);
    });
  }

  static of(
    links: readonly DiagramLink[],
    boxes: ReadonlyMap<string, Box>,
    wide: boolean,
    gap: number,
  ): Map<string, Route> {
    const out = new Map<string, Route>();
    const known = links.filter(
      (link) => link.from !== link.to && boxes.has(link.from) && boxes.has(link.to),
    );
    if (!known.length) return out;
    const routes = new DiagramRoutes(boxes, wide, gap);
    const plans = known.map((link) => routes.plan(link));
    routes.spread(plans);
    for (const plan of plans) out.set(plan.key, new Route(routes.points(plan)));
    return out;
  }

  private plan(link: DiagramLink): Plan {
    const key = Links.key(link.from, link.to);
    const a = this.layerOf.get(link.from) as number;
    const b = this.layerOf.get(link.to) as number;
    const base = { key, from: link.from, to: link.to, lanes: [], bulge: 0 };
    if (a !== b) {
      const step = b > a ? 1 : -1;
      const lanes: Lane[] = [];
      for (let k = a + step; k !== b; k += step) lanes.push(this.lane(k, link, step));
      return {
        ...base,
        out: step > 0 ? "after" : "before",
        in: step > 0 ? "before" : "after",
        lanes,
      };
    }
    const ids = this.layers[a].ids;
    const i = ids.indexOf(link.from);
    const j = ids.indexOf(link.to);
    if (Math.abs(i - j) === 1) {
      return { ...base, out: j > i ? "high" : "low", in: j > i ? "low" : "high" };
    }
    const outward = a === 0 && this.layers.length > 1 ? "before" : "after";
    return { ...base, out: outward, in: outward, bulge: this.room(a, outward) * 0.55 };
  }

  private lane(k: number, link: DiagramLink, step: number): Lane {
    const layer = this.layers[k];
    const from = this.mid(link.from);
    const to = this.mid(link.to);
    const along = (this.middle(layer) - from) / (to - from || 1);
    const target = this.cross(link.from) + (this.cross(link.to) - this.cross(link.from)) * along;
    const margin = Math.max(this.gap * 3, this.size(layer.ids[0], "c") * 0.22);
    const first = this.extents.get(layer.ids[0]) as Extent;
    const last = this.extents.get(layer.ids.at(-1) as string) as Extent;
    const spots: { c: number; room: number }[] = [
      { c: first.c0 - margin, room: margin },
      { c: last.c1 + margin, room: margin },
    ];
    for (let n = 1; n < layer.ids.length; n++) {
      const low = this.extents.get(layer.ids[n - 1]) as Extent;
      const high = this.extents.get(layer.ids[n]) as Extent;
      if (high.c0 - low.c1 > this.gap * 2) {
        spots.push({ c: (low.c1 + high.c0) / 2, room: (high.c0 - low.c1) / 2 - this.gap });
      }
    }
    const spot = spots.reduce((best, s) =>
      Math.abs(s.c - target) < Math.abs(best.c - target) ? s : best,
    );
    const slot = `${k}:${Math.round(spot.c)}`;
    const count = this.used.get(slot) ?? 0;
    this.used.set(slot, count + 1);
    const shift = Math.min(spot.room, this.gap * 1.6 * Math.ceil(count / 2)) * (count % 2 ? 1 : -1);
    const near = step > 0 ? layer.m0 - this.gap : layer.m1 + this.gap;
    const far = step > 0 ? layer.m1 + this.gap : layer.m0 - this.gap;
    return { enter: near, exit: far, c: spot.c + (count ? shift : 0) };
  }

  private spread(plans: readonly Plan[]): void {
    const sides = new Map<string, { slot: string; toward: number }[]>();
    const add = (id: string, side: Side, slot: string, toward: number) => {
      if (side === "low" || side === "high") return;
      const at = `${id}|${side}`;
      sides.set(at, [...(sides.get(at) ?? []), { slot, toward }]);
    };
    for (const plan of plans) {
      const first = plan.lanes[0]?.c ?? this.cross(plan.to);
      const last = plan.lanes.at(-1)?.c ?? this.cross(plan.from);
      add(plan.from, plan.out, `${plan.key}|out`, first);
      add(plan.to, plan.in, `${plan.key}|in`, last);
    }
    for (const [at, list] of sides) {
      const id = at.split("|")[0];
      const size = this.size(id, "c");
      const step = list.length > 1 ? Math.min(size * 0.22, (size * 0.6) / (list.length - 1)) : 0;
      list
        .sort((a, b) => a.toward - b.toward)
        .forEach((entry, k) => {
          this.ports.set(entry.slot, this.cross(id) + (k - (list.length - 1) / 2) * step);
        });
    }
  }

  private points(plan: Plan): Point[] {
    const start = this.port(plan.from, plan.out, `${plan.key}|out`);
    const end = this.port(plan.to, plan.in, `${plan.key}|in`);
    if (plan.out === "low" || plan.out === "high") return [this.point(start), this.point(end)];
    if (plan.bulge) {
      const sign = plan.out === "after" ? 1 : -1;
      return this.curve(
        start,
        { m: start.m + sign * plan.bulge, c: start.c },
        { m: end.m + sign * plan.bulge, c: end.c },
        end,
      );
    }
    const stops: { m: number; c: number }[] = [start];
    for (const lane of plan.lanes)
      stops.push({ m: lane.enter, c: lane.c }, { m: lane.exit, c: lane.c });
    stops.push(end);
    const out: Point[] = [];
    for (let i = 0; i + 1 < stops.length; i += 2) {
      const a = stops[i];
      const b = stops[i + 1];
      const mid = (a.m + b.m) / 2;
      out.push(...this.curve(a, { m: mid, c: a.c }, { m: mid, c: b.c }, b));
    }
    return out;
  }

  private port(id: string, side: Side, slot: string): { m: number; c: number } {
    const e = this.extents.get(id) as Extent;
    const c = this.ports.get(slot) ?? this.cross(id);
    switch (side) {
      case "after":
        return { m: e.m1 + this.gap, c };
      case "before":
        return { m: e.m0 - this.gap, c };
      case "low":
        return { m: this.mid(id), c: e.c0 - this.gap };
      case "high":
        return { m: this.mid(id), c: e.c1 + this.gap };
    }
  }

  private curve(
    a: { m: number; c: number },
    b: { m: number; c: number },
    c: { m: number; c: number },
    d: { m: number; c: number },
  ): Point[] {
    return Array.from({ length: DiagramRoutes.CURVE + 1 }, (_, k) => {
      const s = k / DiagramRoutes.CURVE;
      const u = 1 - s;
      const mix = (p: number, q: number, r: number, v: number) =>
        u * u * u * p + 3 * u * u * s * q + 3 * u * s * s * r + s * s * s * v;
      return this.point({ m: mix(a.m, b.m, c.m, d.m), c: mix(a.c, b.c, c.c, d.c) });
    });
  }

  private room(k: number, side: "after" | "before"): number {
    const layer = this.layers[k];
    const next = this.layers[side === "after" ? k + 1 : k - 1];
    const fallback = this.size(layer.ids[0], "m") * 0.8;
    if (!next) return fallback;
    return side === "after" ? next.m0 - layer.m1 : layer.m0 - next.m1;
  }

  private extent(box: Box): Extent {
    return this.wide
      ? { m0: box.x, m1: box.x + box.w, c0: box.y, c1: box.y + box.h }
      : { m0: box.y, m1: box.y + box.h, c0: box.x, c1: box.x + box.w };
  }

  private point(at: { m: number; c: number }): Point {
    return this.wide ? { x: at.m, y: at.c } : { x: at.c, y: at.m };
  }

  private mid(id: string): number {
    const e = this.extents.get(id) as Extent;
    return (e.m0 + e.m1) / 2;
  }

  private cross(id: string): number {
    const e = this.extents.get(id) as Extent;
    return (e.c0 + e.c1) / 2;
  }

  private middle(layer: Layer): number {
    return (layer.m0 + layer.m1) / 2;
  }

  private size(id: string, axis: "m" | "c"): number {
    const e = this.extents.get(id) as Extent;
    return axis === "m" ? e.m1 - e.m0 : e.c1 - e.c0;
  }
}
