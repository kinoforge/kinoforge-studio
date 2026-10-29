import type { RoadArm, RoadCar, RoadLayout } from "./spec.ts";

export interface Point {
  x: number;
  y: number;
}

/** A spot on a path: where it is and the way it faces (radians, screen axes). */
export interface Pose extends Point {
  angle: number;
}

/** A car's footprint: its length along the way it faces and its width across. */
export const CAR_SIZE: Record<"car" | "truck" | "bike", { long: number; wide: number }> = {
  car: { long: 0.12, wide: 0.062 },
  truck: { long: 0.2, wide: 0.078 },
  bike: { long: 0.085, wide: 0.036 },
};

export class CarKinds {
  static of(car: RoadCar): keyof typeof CAR_SIZE {
    return car === "truck" ? "truck" : car === "bike" ? "bike" : "car";
  }
}

/** A line through points, walked by distance. */
export class RoadPath {
  private readonly lengths: number[] = [0];

  constructor(readonly points: readonly Point[]) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      this.lengths.push(this.lengths[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
  }

  get length(): number {
    return this.lengths.at(-1) as number;
  }

  at(share: number): Pose {
    const points = this.points;
    if (points.length < 2) return { ...points[0], angle: -Math.PI / 2 };
    const want = Math.min(1, Math.max(0, share)) * this.length;
    let i = 1;
    while (i < points.length - 1 && this.lengths[i] < want) i++;
    const a = points[i - 1];
    const b = points[i];
    const part = this.lengths[i] - this.lengths[i - 1];
    const k = part ? (want - this.lengths[i - 1]) / part : 0;
    return {
      x: a.x + (b.x - a.x) * k,
      y: a.y + (b.y - a.y) * k,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  static line(a: Point, b: Point): Point[] {
    return [a, b];
  }

  static bezier(a: Point, c1: Point, c2: Point, b: Point, steps = 24): Point[] {
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const u = 1 - t;
      return {
        x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
        y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
      };
    });
  }

  static arc(center: Point, radius: number, from: number, to: number): Point[] {
    const steps = Math.max(4, Math.ceil(Math.abs(to - from) / 0.08));
    return Array.from({ length: steps + 1 }, (_, i) => {
      const angle = from + ((to - from) * i) / steps;
      return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
    });
  }

  static join(...parts: Point[][]): RoadPath {
    const out: Point[] = [];
    for (const part of parts) {
      for (const point of part) {
        const last = out.at(-1);
        if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 1e-6) out.push(point);
      }
    }
    return new RoadPath(out);
  }
}

const ARM_ANGLES: Record<RoadArm, number> = {
  right: 0,
  back: Math.PI / 2,
  left: Math.PI,
  ahead: -Math.PI / 2,
};

/** One road layout in world units (1 = the short side of the area), drawn for traffic that
 *  keeps right with the learner driving up the screen; left-hand traffic is its mirror image.
 *  Every lane, line and turn a car takes is worked out here, so a board only names arms. */
export class RoadMap {
  static readonly ARMS: Record<RoadLayout, readonly RoadArm[]> = {
    straight: ["back", "ahead"],
    crossroads: ["back", "left", "ahead", "right"],
    junction: ["back", "left", "right"],
    roundabout: ["back", "left", "ahead", "right"],
  };
  static readonly LANE = 0.1;
  static readonly GAP = 0.05;
  /** How far a car on a straight road holds ahead of the learner, and the learner itself. */
  static readonly HOLD_AHEAD = -0.22;
  static readonly HOLD_YOU = 0.3;
  static readonly RING = 0.15;
  static readonly RING_HALF = 0.058;

  readonly center: Point;
  readonly half: number;
  readonly box: number;

  constructor(
    readonly layout: RoadLayout,
    readonly lanes: number,
    /** Half the area's width and height in world units. */
    readonly extent: Point,
  ) {
    this.center = { x: 0, y: layout === "junction" ? -0.08 : 0 };
    this.half = layout === "straight" ? lanes * RoadMap.LANE : RoadMap.LANE;
    this.box =
      layout === "roundabout" ? RoadMap.RING + RoadMap.RING_HALF + 0.015 : RoadMap.LANE + 0.03;
  }

  has(arm: RoadArm): boolean {
    return RoadMap.ARMS[this.layout].includes(arm);
  }

  get arms(): readonly RoadArm[] {
    return RoadMap.ARMS[this.layout];
  }

  /** The way out from the centre along an arm. */
  dir(arm: RoadArm): Point {
    const angle = ARM_ANGLES[arm];
    return { x: Math.round(Math.cos(angle)), y: Math.round(Math.sin(angle)) };
  }

  /** How far an arm runs from the centre before it leaves the area. */
  reach(arm: RoadArm): number {
    const dir = this.dir(arm);
    const edge = dir.x
      ? this.extent.x - dir.x * this.center.x
      : this.extent.y - dir.y * this.center.y;
    return edge + 0.16;
  }

  /** The middle of a lane on an arm, `at` from the centre. `inbound` lanes drive toward the
   *  centre, on the driver's right; lane 0 is the one beside the middle of the road. */
  lanePoint(arm: RoadArm, at: number, inbound: boolean, lane = 0): Point {
    const dir = this.dir(arm);
    const across = (lane + 0.5) * RoadMap.LANE * (inbound ? 1 : -1);
    return {
      x: this.center.x + dir.x * at + dir.y * across,
      y: this.center.y + dir.y * at - dir.x * across,
    };
  }

  /** Where the front car waits at an arm's line, and each one queued behind it. On a straight
   *  road cars hold in view as the road runs under them: the learner (slot -1) low on the
   *  screen, the others ahead of it. */
  stopAt(arm: RoadArm, slot: number, long: number, lane = 0): Point {
    if (this.layout === "straight") {
      const hold = slot < 0 ? RoadMap.HOLD_YOU : RoadMap.HOLD_AHEAD + slot * (0.12 + 0.07);
      return this.lanePoint(arm, hold, true, lane);
    }
    return this.lanePoint(
      arm,
      this.box + 0.02 + long / 2 + slot * (0.12 + RoadMap.GAP),
      true,
      lane,
    );
  }

  /** From the box edge on arm `from` to the box edge on arm `to`, through the junction. */
  turn(from: RoadArm, to: RoadArm): Point[] {
    if (this.layout === "roundabout") return this.ring(from, to);
    const a = this.lanePoint(from, this.box, true);
    const b = this.lanePoint(to, this.box, false);
    const din = this.dir(from);
    const dout = this.dir(to);
    if (from === to) {
      const pull = this.box * 1.3;
      return RoadPath.bezier(
        a,
        { x: a.x - din.x * pull, y: a.y - din.y * pull },
        { x: b.x - dout.x * pull, y: b.y - dout.y * pull },
        b,
      );
    }
    if (din.x === -dout.x && din.y === -dout.y) return RoadPath.line(a, b);
    // Where the lane in meets the lane out: both ends of the curve aim at it.
    const corner = din.x ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
    const toward = (p: Point) => ({
      x: p.x + (corner.x - p.x) * 0.55,
      y: p.y + (corner.y - p.y) * 0.55,
    });
    return RoadPath.bezier(a, toward(a), toward(b), b);
  }

  /** Round the ring the way traffic goes (anticlockwise on screen for traffic on the right),
   *  joining at arm `from` and leaving at arm `to`; the same arm goes all the way round. */
  private ring(from: RoadArm, to: RoadArm): Point[] {
    const r = RoadMap.RING;
    const lean = Math.asin(Math.min(0.9, (RoadMap.LANE * 0.5) / r));
    const enter = ARM_ANGLES[from] - lean;
    let leave = ARM_ANGLES[to] + lean;
    while (leave >= enter - 0.2) leave -= Math.PI * 2;
    const c = this.center;
    const on = (angle: number) => ({ x: c.x + r * Math.cos(angle), y: c.y + r * Math.sin(angle) });
    const a = this.lanePoint(from, this.box, true);
    const b = this.lanePoint(to, this.box, false);
    const join = on(enter - 0.25);
    const part = on(leave + 0.25);
    const tangent = (angle: number, len: number) => ({
      x: Math.sin(angle) * len,
      y: -Math.cos(angle) * len,
    });
    const din = this.dir(from);
    const dout = this.dir(to);
    const tin = tangent(enter - 0.25, 0.05);
    const tout = tangent(leave + 0.25, 0.05);
    return [
      ...RoadPath.bezier(
        a,
        { x: a.x - din.x * 0.04, y: a.y - din.y * 0.04 },
        { x: join.x - tin.x, y: join.y - tin.y },
        join,
        10,
      ),
      ...RoadPath.arc(c, r, enter - 0.25, leave + 0.25),
      ...RoadPath.bezier(
        part,
        { x: part.x + tout.x, y: part.y + tout.y },
        { x: b.x - dout.x * 0.04, y: b.y - dout.y * 0.04 },
        b,
        10,
      ),
    ];
  }

  /** Where someone crossing an arm walks: from the kerb on one side to the other. */
  crossing(arm: RoadArm): [Point, Point] {
    const at = this.box + 0.24;
    const dir = this.dir(arm);
    const side = this.half + 0.04;
    const mid = { x: this.center.x + dir.x * at, y: this.center.y + dir.y * at };
    return [
      { x: mid.x + dir.y * side, y: mid.y - dir.x * side },
      { x: mid.x - dir.y * side, y: mid.y + dir.x * side },
    ];
  }
}
