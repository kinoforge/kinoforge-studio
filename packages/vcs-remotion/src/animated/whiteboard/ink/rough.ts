import type { Point } from "./path.ts";

export type Random = () => number;

export class Rough {
  static random(key: string): Random {
    let seed = 2166136261;
    for (let i = 0; i < key.length; i++) seed = Math.imul(seed ^ key.charCodeAt(i), 16777619);
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  static spread(rng: Random, size: number): number {
    return (rng() * 2 - 1) * size;
  }

  static curve(a: Point, b: Point, bow: number, steps = 18): Point[] {
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const cx = mx - ((b[1] - a[1]) / len) * bow * len;
    const cy = my + ((b[0] - a[0]) / len) * bow * len;
    const out: Point[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      out.push([u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]);
    }
    return out;
  }

  static line(a: Point, b: Point, rng: Random, bow = 0.025): Point[] {
    const jitter = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.006;
    return Rough.curve(
      [a[0] + Rough.spread(rng, jitter), a[1] + Rough.spread(rng, jitter)],
      [b[0] + Rough.spread(rng, jitter), b[1] + Rough.spread(rng, jitter)],
      Rough.spread(rng, bow),
    );
  }

  static arrow(a: Point, b: Point, rng: Random, head: number, bow = 0.06): Point[][] {
    const body = Rough.curve(a, b, bow * (rng() < 0.5 ? -1 : 1));
    const tip = body[body.length - 1];
    const back = body[body.length - 4];
    const angle = Math.atan2(tip[1] - back[1], tip[0] - back[0]);
    const wing = (side: number): Point => [
      tip[0] - Math.cos(angle + side * 0.48) * head,
      tip[1] - Math.sin(angle + side * 0.48) * head,
    ];
    return [body, [wing(1), tip, wing(-1)]];
  }

  static ellipse(cx: number, cy: number, rx: number, ry: number, rng: Random, turns = 1.12): Point[] {
    const steps = 64;
    const start = rng() * Math.PI * 2;
    const out: Point[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = start + t * turns * Math.PI * 2;
      const wobble = 1 + Math.sin(t * Math.PI * 3 + start) * 0.035 + (t - 0.5) * 0.06;
      out.push([cx + Math.cos(a) * rx * wobble, cy + Math.sin(a) * ry * wobble]);
    }
    return out;
  }

  static box(x: number, y: number, w: number, h: number, rng: Random): Point[] {
    const o = Math.min(w, h) * 0.04;
    const corners: Point[] = [
      [x + Rough.spread(rng, o), y + Rough.spread(rng, o)],
      [x + w + Rough.spread(rng, o), y + Rough.spread(rng, o)],
      [x + w + Rough.spread(rng, o), y + h + Rough.spread(rng, o)],
      [x + Rough.spread(rng, o), y + h + Rough.spread(rng, o)],
    ];
    const out: Point[] = [];
    for (let i = 0; i < 4; i++) {
      const side = Rough.curve(corners[i], corners[(i + 1) % 4], Rough.spread(rng, 0.012), 10);
      out.push(...(i ? side.slice(1) : side));
    }
    const first = out[0];
    out.push([first[0] + (out[1][0] - first[0]) * 2.5, first[1] + (out[1][1] - first[1]) * 2.5]);
    return out;
  }

  static underline(x: number, y: number, w: number, rng: Random): Point[] {
    return Rough.curve([x, y + Rough.spread(rng, w * 0.01)], [x + w, y - w * 0.02], -0.04 - rng() * 0.03, 20);
  }

  static check(cx: number, cy: number, s: number): Point[][] {
    return [[[cx - s * 0.45, cy], [cx - s * 0.12, cy + s * 0.35], [cx + s * 0.5, cy - s * 0.4]]];
  }

  static cross(cx: number, cy: number, w: number, h: number, rng: Random): Point[][] {
    return [
      Rough.line([cx - w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], rng, 0.04),
      Rough.line([cx + w / 2, cy - h / 2], [cx - w / 2, cy + h / 2], rng, 0.04),
    ];
  }
}
