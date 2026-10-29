import { type Beat, type Board, PIECE_KINDS, type Piece } from "../spec.ts";
import { CAR_SIZE, CarKinds, type Point, type Pose, RoadMap, RoadPath } from "./geometry.ts";
import type {
  LightState,
  MeasurePart,
  RoadArm,
  RoadCar,
  RoadLane,
  RoadLayout,
  RoadLook,
  TrafficSide,
} from "./spec.ts";

/** Where a car waits: the arm and lane it is on and its place in the queue there (-1: the
 *  learner's own spot on a straight road), held at `at` along the road when it merged there,
 *  or parked. */
export interface Rest {
  arm: RoadArm;
  lane: number;
  slot: number;
  at?: number;
  parked?: boolean;
}

export interface RoadShape {
  layout: RoadLayout;
  lanes: number;
  cars: Map<RoadCar, Rest>;
  signals: Map<RoadCar, "left" | "right">;
  zebras: Set<RoadArm>;
  lights: Map<RoadArm, LightState>;
  /** A straight road with cars parked at its kerb. */
  kerb: boolean;
}

/** What one drive beat does to a car: where it starts (a rest, or the far end of an arm) and
 *  where it ends (a rest, or out by an arm). */
export interface Trip {
  car: RoadCar;
  from: Rest | null;
  enter: RoadArm;
  lane: number;
  to: Rest | null;
  exit: RoadArm | null;
}

const OPPOSITE: Record<RoadArm, RoadArm> = {
  back: "ahead",
  ahead: "back",
  left: "right",
  right: "left",
};

/** How the road pieces change the road, shared by the memory of earlier scenes and the
 *  script of this one. Pieces are read for traffic on the right; on the left they are
 *  mirrored first, so the drawing is the mirror image of the same road. */
export class RoadRules {
  static empty(): RoadShape {
    return {
      layout: "straight",
      lanes: 1,
      cars: new Map(),
      signals: new Map(),
      zebras: new Set(),
      lights: new Map(),
      kerb: false,
    };
  }

  static isRoad(board: Board): boolean {
    return board.beats.some((beat) => PIECE_KINDS[beat.piece.type].layer === "road");
  }

  static flip(piece: Piece, side: TrafficSide): Piece {
    if (side === "right") return piece;
    const arm = <T extends string>(value: T): T =>
      (value === "left" ? "right" : value === "right" ? "left" : value) as T;
    switch (piece.type) {
      case "drive":
        return {
          ...piece,
          from: piece.from && arm(piece.from),
          to: arm(piece.to),
          lane: piece.lane && arm(piece.lane),
        };
      case "signal":
        return { ...piece, side: arm(piece.side) };
      case "look": {
        const toward = piece.toward.replace(/^(left|right)/, (side) => arm(side)) as RoadLook;
        return { ...piece, toward };
      }
      case "cross":
        return { ...piece, at: arm(piece.at) };
      case "light":
        return { ...piece, at: piece.at && arm(piece.at) };
      default:
        return piece;
    }
  }

  static lane(name: RoadLane | undefined, lanes: number): number | null {
    if (!name || lanes < 2) return name ? 0 : null;
    if (name === "left") return 0;
    if (name === "middle") return Math.min(1, lanes - 1);
    return lanes - 1;
  }

  /** Applies one piece to the shape; a drive returns the trip it makes, or null when the road
   *  has no such arm (the beat is skipped). */
  static apply(shape: RoadShape, piece: Piece): Trip | null {
    switch (piece.type) {
      case "road": {
        const lanes = RoadRules.lanes(piece.layout, piece.lanes);
        if (piece.layout !== shape.layout || lanes !== shape.lanes) {
          Object.assign(shape, { ...RoadRules.empty(), layout: piece.layout, lanes });
        }
        return null;
      }
      case "light": {
        const at = piece.at ?? "back";
        const linear = RoadMap.LINEAR.includes(shape.layout);
        if (!linear && RoadRules.arms(shape.layout).includes(at)) shape.lights.set(at, piece.state);
        return null;
      }
      case "park": {
        const car = piece.car ?? "you";
        const rest = shape.cars.get(car);
        if (!rest || rest.parked || !RoadRules.parks(shape.layout)) return null;
        shape.cars.set(car, { ...rest, slot: -2, at: undefined, parked: true });
        if (shape.layout === "straight") shape.kerb = true;
        return null;
      }
      case "drive":
        return RoadRules.drive(shape, piece);
      case "signal":
        if (piece.side === "off") shape.signals.delete(piece.car);
        else shape.signals.set(piece.car, piece.side);
        return null;
      case "cross":
        if (RoadRules.arms(shape.layout).includes(piece.at)) shape.zebras.add(piece.at);
        return null;
      default:
        return null;
    }
  }

  static arms(layout: RoadLayout): readonly RoadArm[] {
    return RoadMap.ARMS[layout];
  }

  static lanes(layout: RoadLayout, lanes: number | undefined): number {
    if (layout === "straight") return lanes ?? 1;
    if (layout === "motorway") return Math.max(2, lanes ?? 2);
    return 1;
  }

  /** Where a car can park: a car park's free bay, or the kerb of a straight road. */
  static parks(layout: RoadLayout): boolean {
    return layout === "car-park" || layout === "straight";
  }

  private static drive(shape: RoadShape, piece: Extract<Piece, { type: "drive" }>): Trip | null {
    const arms = RoadRules.arms(shape.layout);
    const linear = RoadMap.LINEAR.includes(shape.layout);
    const rest = shape.cars.get(piece.car) ?? null;
    // A motorway's slip road joins from the kerb side, whichever side a writer names.
    const from = shape.layout === "motorway" && piece.from === "left" ? "right" : piece.from;
    const enter = rest?.arm ?? from ?? "back";
    if (!arms.includes(enter)) return null;
    // The slip road joins the outer lane; every lane on a linear road counts from the middle.
    const slip = enter === "right";
    const lane = slip
      ? shape.lanes - 1
      : (RoadRules.lane(piece.lane, shape.lanes) ?? rest?.lane ?? (linear ? shape.lanes - 1 : 0));
    if (piece.to === "stop") {
      if (rest && !rest.parked && rest.lane === lane) return null;
      const learner = linear && piece.car === "you" && !slip;
      const queued = [...shape.cars.entries()].filter(
        ([id, at]) => id !== piece.car && at.arm === enter && at.lane === lane && at.slot >= 0,
      ).length;
      const to: Rest = slip
        ? { arm: "back", lane, slot: queued, at: RoadMap.MERGE }
        : {
            arm: enter,
            lane,
            slot: learner ? -1 : queued,
            at: rest?.parked ? undefined : rest?.at,
          };
      shape.cars.set(piece.car, to);
      return { car: piece.car, from: rest, enter, lane, to, exit: null };
    }
    const exit = piece.to;
    const way = slip ? "ahead" : OPPOSITE[enter];
    if (!arms.includes(exit) || (linear && exit !== way)) return null;
    shape.cars.delete(piece.car);
    shape.signals.delete(piece.car);
    return { car: piece.car, from: rest, enter, lane, to: null, exit };
  }
}

/** The road once earlier scenes have run: its layout and who is waiting where. */
export class RoadMemory {
  static before(history: readonly Board[], side: TrafficSide): RoadShape {
    const shape = RoadRules.empty();
    for (const board of history) {
      for (const beat of board.beats) RoadRules.apply(shape, RoadRules.flip(beat.piece, side));
    }
    return shape;
  }
}

export interface Move {
  path: RoadPath;
  at: number;
  seconds: number;
  /** It starts from standing, and it stops at the end. */
  from: boolean;
  stop: boolean;
  /** A sideways move on a straight road: the car changes lane as the road runs on. */
  shift: boolean;
  /** Reversing: the car faces away from the way it moves. */
  back?: boolean;
  label?: string;
}

export interface Track {
  car: RoadCar;
  rest: Pose | null;
  moves: Move[];
  /** When the road changes under it and it goes. */
  until: number | null;
}

export interface Era {
  map: RoadMap;
  at: number | null;
  zebras: Map<RoadArm, number | null>;
  /** Since when cars stand parked at a straight road's kerb (null: from the start). */
  kerb: number | null | undefined;
}

export interface Light {
  era: number;
  arm: RoadArm;
  state: LightState;
  at: number;
}

export interface Signal {
  car: RoadCar;
  side: "left" | "right";
  at: number;
  until: number;
}

export interface Look {
  car: RoadCar;
  toward: RoadLook;
  label?: string;
  at: number;
  until: number;
}

export interface Measure {
  car: RoadCar;
  parts: MeasurePart[];
  unit?: string;
  at: number;
  until: number;
}

export interface Walk {
  arm: RoadArm;
  at: number;
  seconds: number;
}

/** One scene's road as times: the layout (and any change of it), each car's moves, and the
 *  signals, looks, distances and people crossing the narration brings on. */
export class RoadScript {
  static readonly SPEED = 0.34;
  static readonly WALK = 2.4;

  readonly eras: Era[] = [];
  readonly tracks: Track[] = [];
  readonly signals: Signal[] = [];
  readonly looks: Look[] = [];
  readonly measures: Measure[] = [];
  readonly walks: Walk[] = [];
  readonly lights: Light[] = [];
  private readonly shape: RoadShape;
  private readonly live = new Map<RoadCar, Track>();
  private readonly free = new Map<RoadCar, number>();

  constructor(
    start: RoadShape,
    beats: readonly Beat[],
    starts: readonly number[],
    private readonly seconds: number,
    private readonly side: TrafficSide,
    private readonly extent: Point,
  ) {
    this.shape = {
      ...start,
      cars: new Map(start.cars),
      signals: new Map(start.signals),
      zebras: new Set(start.zebras),
      lights: new Map(start.lights),
    };
    this.begin(null);
    for (const [car, rest] of this.shape.cars) {
      this.track(car).rest = this.restPose(car, rest);
    }
    for (const [car, side] of this.shape.signals) {
      this.signals.push({ car, side, at: 0, until: seconds });
    }
    beats.forEach((beat, i) => {
      const at = starts[i];
      const next = starts[i + 1] ?? seconds;
      this.play(RoadRules.flip(beat.piece, side), at, next);
    });
  }

  get era(): Era {
    return this.eras.at(-1) as Era;
  }

  private begin(at: number | null): void {
    const map = new RoadMap(this.shape.layout, this.shape.lanes, this.extent);
    const zebras = new Map<RoadArm, number | null>(
      [...this.shape.zebras].map((arm) => [arm, null]),
    );
    this.eras.push({ map, at, zebras, kerb: this.shape.kerb ? null : undefined });
    for (const [arm, state] of this.shape.lights) {
      this.lights.push({ era: this.eras.length - 1, arm, state, at: at ?? 0 });
    }
  }

  private play(piece: Piece, at: number, next: number): void {
    if (PIECE_KINDS[piece.type].layer !== "road") return;
    const layout = this.shape.layout;
    const lanes = this.shape.lanes;
    if (
      piece.type === "look" ||
      piece.type === "measure" ||
      piece.type === "signal" ||
      piece.type === "park"
    ) {
      this.bringOn(piece.car ?? "you", at);
    }
    const before = piece.type === "park" ? this.shape.cars.get(piece.car ?? "you") : undefined;
    const trip = RoadRules.apply(this.shape, piece);
    switch (piece.type) {
      case "road":
        if (layout !== this.shape.layout || lanes !== this.shape.lanes) this.change(at);
        return;
      case "drive":
        if (trip) this.drive(trip, at + 0.05, piece.label);
        return;
      case "signal":
        this.endSignal(piece.car, at);
        if (piece.side !== "off") {
          this.signals.push({ car: piece.car, side: piece.side, at, until: this.seconds });
        }
        return;
      case "look":
        const from = Math.max(at, this.free.get(piece.car ?? "you") ?? 0);
        this.looks.push({
          car: piece.car ?? "you",
          toward: piece.toward,
          label: piece.label,
          at: from,
          until: Math.min(this.seconds, Math.max(from + 1.8, next)),
        });
        return;
      case "measure":
        for (const measure of this.measures) measure.until = Math.min(measure.until, at);
        this.measures.push({
          car: piece.car ?? "you",
          parts: piece.parts,
          unit: piece.unit,
          at: Math.max(at, this.free.get(piece.car ?? "you") ?? 0),
          until: this.seconds,
        });
        return;
      case "light": {
        const arm = piece.at ?? "back";
        if (this.shape.lights.get(arm) !== piece.state || !this.era.map.has(arm)) return;
        this.lights.push({ era: this.eras.length - 1, arm, state: piece.state, at });
        return;
      }
      case "park":
        if (before && !before.parked && this.shape.cars.get(piece.car ?? "you")?.parked) {
          this.park(piece.car ?? "you", before, at);
        }
        return;
      case "cross":
        if (!this.era.map.has(piece.at)) return;
        if (!this.era.zebras.has(piece.at)) this.era.zebras.set(piece.at, at);
        this.walks.push({ arm: piece.at, at: at + 0.3, seconds: RoadScript.WALK });
        return;
      default:
        return;
    }
  }

  /** A car the narration points at before it drove on comes in and takes its spot. */
  private bringOn(car: RoadCar, at: number): void {
    if (this.shape.cars.has(car) || this.live.get(car)?.moves.length) return;
    const trip = RoadRules.apply(this.shape, { type: "drive", car, to: "stop" });
    if (trip) this.drive(trip, at);
  }

  private change(at: number): void {
    for (const track of this.live.values()) track.until = at;
    for (const signal of this.signals) signal.until = Math.min(signal.until, at);
    for (const measure of this.measures) measure.until = Math.min(measure.until, at);
    this.live.clear();
    this.free.clear();
    this.begin(at);
  }

  private track(car: RoadCar): Track {
    let track = this.live.get(car);
    if (!track) {
      track = { car, rest: null, moves: [], until: null };
      this.live.set(car, track);
      this.tracks.push(track);
    }
    return track;
  }

  private drive(trip: Trip, beat: number, label?: string): void {
    const map = this.era.map;
    const { long } = CAR_SIZE[CarKinds.of(trip.car)];
    const pulled = trip.from?.parked ? this.pullOut(trip.lane) : [];
    const slip = trip.enter === "right" && map.layout === "motorway" && !trip.from;
    const start =
      pulled.at(-1) ??
      (trip.from
        ? map.stopAt(trip.from.arm, trip.from.slot, long, trip.from.lane, trip.from.at)
        : map.lanePoint(trip.enter, map.reach(trip.enter) + long, true, trip.lane));
    const linear = map.linear;
    let points: Point[];
    let shift = false;
    if (slip) {
      points = map.slip();
      if (!trip.to) points.push(map.lanePoint("back", -map.reach("ahead") - long, true, trip.lane));
    } else if (trip.to) {
      const end = map.stopAt(trip.to.arm, trip.to.slot, long, trip.to.lane, trip.to.at);
      shift = linear && !!trip.from && !pulled.length;
      points = [...pulled, start, end];
    } else if (linear) {
      const end = map.lanePoint(
        trip.enter,
        -map.reach(trip.exit as RoadArm) - long,
        true,
        trip.lane,
      );
      const lift = { x: end.x, y: start.y + Math.sign(end.y - start.y) * 0.28 };
      points = RoadPath.bezier(
        start,
        { x: start.x, y: (start.y + lift.y) / 2 },
        { x: end.x, y: (start.y + lift.y) / 2 },
        lift,
        14,
      );
      points = [...pulled, ...points, end];
    } else {
      const exit = trip.exit as RoadArm;
      points = [
        start,
        ...map.turn(trip.enter, exit),
        map.lanePoint(exit, map.reach(exit) + long, false),
      ];
    }
    const path = RoadPath.join(points);
    if (path.length < 1e-3) return;
    this.push(trip.car, { path, from: !!trip.from, stop: !!trip.to, shift, label }, beat);
    if (!trip.to) {
      this.endSignal(trip.car, this.free.get(trip.car) ?? beat);
      this.live.delete(trip.car);
      this.free.delete(trip.car);
    }
  }

  private push(car: RoadCar, move: Omit<Move, "at" | "seconds">, beat: number, pace = 1): void {
    const at = Math.max(beat, this.free.get(car) ?? 0);
    const seconds = Math.max(move.shift ? 1.1 : 0.9, move.path.length / RoadScript.SPEED) * pace;
    this.track(car).moves.push({ ...move, at, seconds });
    this.free.set(car, at + seconds);
  }

  /** Into the free bay or the kerb gap: on past it, then reversing in. */
  private park(car: RoadCar, before: Rest, beat: number): void {
    const map = this.era.map;
    const { long } = CAR_SIZE[CarKinds.of(car)];
    const start = map.stopAt(before.arm, before.slot, long, before.lane, before.at);
    const spot = map.parkSpot();
    const bay = map.layout === "car-park";
    const past = bay
      ? map.lanePoint("back", spot.y - 0.2, true, before.lane)
      : map.lanePoint("back", RoadMap.PARKED[0] - 0.02, true, map.lanes - 1);
    if (!bay && this.era.kerb === undefined) this.era.kerb = beat;
    const reverse = bay
      ? RoadPath.bezier(
          past,
          { x: past.x, y: past.y + 0.1 },
          { x: spot.x - 0.1, y: spot.y },
          spot,
          16,
        )
      : RoadPath.bezier(
          past,
          { x: past.x, y: past.y + 0.12 },
          { x: spot.x, y: spot.y - 0.12 },
          spot,
          16,
        );
    const forward = RoadPath.join([start, past]);
    const back = RoadPath.join(reverse);
    // Both moves fit in what is left of the scene, quicker when the narration leaves less.
    const natural = (forward.length + back.length) / RoadScript.SPEED + 1.8;
    const room = this.seconds - Math.max(beat, this.free.get(car) ?? 0) - 0.2;
    const pace = room > 1 ? Math.min(1, room / natural) : 1;
    this.push(car, { path: forward, from: true, stop: true, shift: false }, beat, pace);
    this.push(car, { path: back, from: true, stop: true, shift: false, back: true }, beat, pace);
  }

  /** Out of a bay or a kerb space, forward into the lane. */
  private pullOut(lane: number): Point[] {
    const map = this.era.map;
    const spot = map.parkSpot();
    const lanePoint = (y: number) => map.lanePoint("back", y, true, lane);
    if (map.layout === "car-park") {
      const into = lanePoint(spot.y - 0.16);
      return RoadPath.bezier(
        spot,
        { x: spot.x - 0.1, y: spot.y },
        { x: into.x, y: spot.y - 0.04 },
        into,
        14,
      );
    }
    const into = lanePoint(spot.y - 0.24);
    return RoadPath.bezier(
      spot,
      { x: spot.x, y: spot.y - 0.1 },
      { x: into.x, y: into.y + 0.1 },
      into,
      14,
    );
  }

  private endSignal(car: RoadCar, at: number): void {
    for (const signal of this.signals) {
      if (signal.car === car && signal.until > at) signal.until = at;
    }
  }

  private restPose(car: RoadCar, rest: Rest): Pose {
    const map = this.era.map;
    if (rest.parked) return map.parkSpot();
    const { long } = CAR_SIZE[CarKinds.of(car)];
    const point = map.stopAt(rest.arm, rest.slot, long, rest.lane, rest.at);
    const dir = map.dir(rest.arm);
    return { ...point, angle: Math.atan2(-dir.y, -dir.x) };
  }
}

/** Where a car is at a time, and whether it shows. */
export class CarPose {
  static at(track: Track, t: number): { pose: Pose; moving: boolean } | null {
    if (track.until != null && t >= track.until) return null;
    let last: Move | null = null;
    for (const move of track.moves) if (move.at <= t) last = move;
    if (!last) return track.rest ? { pose: track.rest, moving: false } : null;
    const u = (t - last.at) / last.seconds;
    if (u >= 1) {
      if (!last.stop) return null;
      return { pose: CarPose.along(last, 1), moving: false };
    }
    return { pose: CarPose.along(last, u), moving: true };
  }

  private static along(move: Move, u: number): Pose {
    const k = Math.min(1, Math.max(0, u));
    const eased =
      move.from && move.stop
        ? k * k * (3 - 2 * k)
        : move.from
          ? k * k
          : move.stop
            ? 1 - (1 - k) * (1 - k)
            : k;
    const pose = move.path.at(eased);
    if (move.back) return { ...pose, angle: pose.angle + Math.PI };
    if (!move.shift) return pose;
    // A lane change keeps facing up the road, turned a little toward the new lane.
    const [a, b] = [move.path.points[0], move.path.points.at(-1) as Point];
    const lean = Math.sign(b.x - a.x) * 0.35 * Math.sin(Math.PI * k);
    return { ...pose, angle: -Math.PI / 2 + lean };
  }
}
