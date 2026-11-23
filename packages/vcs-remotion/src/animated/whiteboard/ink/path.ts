export type Point = readonly [number, number];

export class Polyline {
  readonly length: number;
  private readonly at: number[];

  readonly points: Point[] = [];

  constructor(parts: readonly (readonly Point[])[]) {
    this.at = [];
    for (const part of parts) {
      part.forEach((point, i) => {
        const prev = this.points[this.points.length - 1];
        const step = i && prev ? Math.hypot(point[0] - prev[0], point[1] - prev[1]) : 0;
        this.at.push((this.at[this.at.length - 1] ?? 0) + step);
        this.points.push(point);
      });
    }
    this.length = this.at[this.at.length - 1] ?? 0;
  }

  point(share: number): Point {
    if (!this.points.length) return [0, 0];
    const want = Math.min(1, Math.max(0, share)) * this.length;
    let lo = 0;
    let hi = this.at.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.at[mid] < want) lo = mid + 1;
      else hi = mid;
    }
    if (lo === 0) return this.points[0];
    const span = this.at[lo] - this.at[lo - 1];
    const k = span > 0 ? (want - this.at[lo - 1]) / span : 0;
    const [ax, ay] = this.points[lo - 1];
    const [bx, by] = this.points[lo];
    return [ax + (bx - ax) * k, ay + (by - ay) * k];
  }

  static d(points: readonly Point[]): string {
    return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  }
}

export class PathInk {
  static readonly STEPS = 12;
  private static readonly ARGS: Record<string, number> = {
    m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0,
  };

  static flatten(d: string): Point[][] {
    const parts: Point[][] = [];
    let out: Point[] = [];
    let x = 0;
    let y = 0;
    let startX = 0;
    let startY = 0;
    let lastCtrl: Point | null = null;
    let lastQuad: Point | null = null;
    for (const [command, values] of PathInk.commands(d)) {
      const lower = command.toLowerCase();
      const rel = command === lower;
      const size = PathInk.ARGS[lower];
      if (size === 0) {
        out.push([startX, startY]);
        x = startX;
        y = startY;
        lastCtrl = lastQuad = null;
        continue;
      }
      for (let i = 0; i + size <= values.length; i += size) {
        const v = values.slice(i, i + size);
        const ox = rel ? x : 0;
        const oy = rel ? y : 0;
        let ctrl: Point | null = null;
        let quad: Point | null = null;
        if (lower === "m") {
          x = v[0] + ox;
          y = v[1] + oy;
          if (i === 0) {
            startX = x;
            startY = y;
            if (out.length) parts.push(out);
            out = [];
          }
          out.push([x, y]);
        } else if (lower === "l" || lower === "t" && !lastQuad) {
          x = v[0] + ox;
          y = v[1] + oy;
          out.push([x, y]);
        } else if (lower === "h") {
          x = v[0] + ox;
          out.push([x, y]);
        } else if (lower === "v") {
          y = v[0] + oy;
          out.push([x, y]);
        } else if (lower === "c" || lower === "s") {
          const c1: Point =
            lower === "c" ? [v[0] + ox, v[1] + oy] : lastCtrl ? [2 * x - lastCtrl[0], 2 * y - lastCtrl[1]] : [x, y];
          const rest = lower === "c" ? v.slice(2) : v;
          const c2: Point = [rest[0] + ox, rest[1] + oy];
          const end: Point = [rest[2] + ox, rest[3] + oy];
          PathInk.cubic(out, [x, y], c1, c2, end);
          ctrl = c2;
          [x, y] = end;
        } else if (lower === "q" || lower === "t") {
          const c: Point = lower === "q" ? [v[0] + ox, v[1] + oy] : [2 * x - (lastQuad as Point)[0], 2 * y - (lastQuad as Point)[1]];
          const end: Point = lower === "q" ? [v[2] + ox, v[3] + oy] : [v[0] + ox, v[1] + oy];
          PathInk.cubic(out, [x, y], [x + (2 / 3) * (c[0] - x), y + (2 / 3) * (c[1] - y)], [end[0] + (2 / 3) * (c[0] - end[0]), end[1] + (2 / 3) * (c[1] - end[1])], end);
          quad = c;
          [x, y] = end;
        } else if (lower === "a") {
          const end: Point = [v[5] + ox, v[6] + oy];
          PathInk.arc(out, [x, y], v[0], v[1], v[2], v[3] !== 0, v[4] !== 0, end);
          [x, y] = end;
        }
        lastCtrl = ctrl;
        lastQuad = quad;
      }
    }
    if (out.length) parts.push(out);
    return parts;
  }

  private static commands(d: string): [string, number[]][] {
    const out: [string, number[]][] = [];
    const re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
    for (const match of d.matchAll(re)) {
      const body = match[2];
      const lower = match[1].toLowerCase();
      const values =
        lower === "a" ? PathInk.arcNumbers(body) : (body.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? []).map(Number);
      out.push([match[1], values]);
    }
    return out;
  }

  private static arcNumbers(body: string): number[] {
    const out: number[] = [];
    const re = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
    let rest = body;
    while (rest.trim()) {
      const slot = out.length % 7;
      if (slot === 3 || slot === 4) {
        const flag = rest.match(/^[\s,]*([01])/);
        if (!flag) break;
        out.push(Number(flag[1]));
        rest = rest.slice(flag[0].length);
        continue;
      }
      re.lastIndex = 0;
      const lead = rest.match(/^[\s,]*/)?.[0].length ?? 0;
      const found = re.exec(rest.slice(lead));
      if (!found || found.index !== 0) break;
      out.push(Number(found[0]));
      rest = rest.slice(lead + found[0].length);
    }
    return out;
  }

  private static cubic(out: Point[], a: Point, b: Point, c: Point, d: Point): void {
    for (let i = 1; i <= PathInk.STEPS; i++) {
      const t = i / PathInk.STEPS;
      const u = 1 - t;
      out.push([
        u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
        u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
      ]);
    }
  }

  private static arc(
    out: Point[],
    from: Point,
    rxIn: number,
    ryIn: number,
    turn: number,
    large: boolean,
    sweep: boolean,
    to: Point,
  ): void {
    let rx = Math.abs(rxIn);
    let ry = Math.abs(ryIn);
    if (!rx || !ry || (from[0] === to[0] && from[1] === to[1])) {
      out.push(to);
      return;
    }
    const phi = (turn * Math.PI) / 180;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);
    const dx = (from[0] - to[0]) / 2;
    const dy = (from[1] - to[1]) / 2;
    const x1 = cos * dx + sin * dy;
    const y1 = -sin * dx + cos * dy;
    const scale = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
    if (scale > 1) {
      rx *= Math.sqrt(scale);
      ry *= Math.sqrt(scale);
    }
    const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
    const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
    const root = Math.sqrt(Math.max(0, num / den)) * (large === sweep ? -1 : 1);
    const cx1 = (root * rx * y1) / ry;
    const cy1 = (-root * ry * x1) / rx;
    const cx = cos * cx1 - sin * cy1 + (from[0] + to[0]) / 2;
    const cy = sin * cx1 + cos * cy1 + (from[1] + to[1]) / 2;
    const angle = (ux: number, uy: number, vx: number, vy: number) => {
      const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
      return a;
    };
    const start = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
    let delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
    if (!sweep && delta > 0) delta -= 2 * Math.PI;
    if (sweep && delta < 0) delta += 2 * Math.PI;
    const steps = Math.max(4, Math.ceil((Math.abs(delta) / (Math.PI / 2)) * PathInk.STEPS));
    for (let i = 1; i <= steps; i++) {
      const a = start + (delta * i) / steps;
      const ex = rx * Math.cos(a);
      const ey = ry * Math.sin(a);
      out.push([cos * ex - sin * ey + cx, sin * ex + cos * ey + cy]);
    }
  }
}
