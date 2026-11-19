import {
  type Action,
  type CastMember3D,
  HELD,
  type Move,
  OFF,
  type Place,
  type PropPick,
  type Rest,
  SEAT,
  type Skit3DLine,
  type Skit3DSet,
  type Spot,
} from "./spec.ts";

export interface Member3DState {
  place: Move;
  rest: Rest;
}

export type Stage3DState = Record<string, Member3DState>;

export interface PropDims {
  tall: number;
  wide: number;
  deep: number;
}

export interface PropPlace {
  x: number;
  z: number;
  turn: number;
  scale: [number, number, number];
  wide: number;
}

export class StageSpots {
  static readonly GAP = 1.7;
  static readonly TALL_GAP = 1.05;
  static readonly ENTRY = 2.8;
  static readonly SPOT_TURN = 0.35;
  static readonly SEAT_SPACE = 0.75;
  static readonly PLACES: Record<Place, number> = {
    far_left: -2,
    left: -1,
    center: 0,
    right: 1,
    far_right: 2,
  };
  static readonly TALL_INSET = 0.78;
  static readonly SPOTS: Record<Spot, [number, number]> = {
    seat: [0, -0.75],
    back_left: [-1.5, -2.4],
    back_center: [0, -2.6],
    back_right: [1.5, -2.4],
    side_left: [-2.4, -0.8],
    side_right: [2.4, -0.8],
    front_left: [-1.8, 1],
    front_right: [1.8, 1],
  };

  static x(place: Place, gap: number): number {
    return StageSpots.PLACES[place] * gap;
  }

  static wing(home: Place, from: number): number {
    return from + (Math.sign(StageSpots.PLACES[home]) || -1) * StageSpots.ENTRY;
  }

  static spot(spot: Spot, gap: number): [number, number] {
    const [across, depth] = StageSpots.SPOTS[spot];
    const inset = gap <= StageSpots.TALL_GAP ? StageSpots.TALL_INSET : 1;
    return [across * gap * inset, depth];
  }

  static prop(pick: PropPick, dims: PropDims, cast: readonly CastMember3D[], gap: number): PropPlace {
    const [spotX, z] = StageSpots.spot(pick.spot, gap);
    const across = dims.deep > dims.wide;
    const base = across ? Math.PI / 2 : 0;
    const long = Math.max(dims.wide, dims.deep);
    if (pick.spot !== SEAT || !cast.length) {
      const turn = base + (spotX === 0 ? 0 : -Math.sign(spotX) * StageSpots.SPOT_TURN);
      return { x: spotX, z, turn, scale: [1, 1, 1], wide: long };
    }
    const homes = cast.map((member) => StageSpots.x(member.place, gap));
    const stretch = long > 0 ? Math.max(1, (cast.length * StageSpots.SEAT_SPACE) / long) : 1;
    return {
      x: (Math.min(...homes) + Math.max(...homes)) / 2,
      z,
      turn: base,
      scale: across ? [1, 1, stretch] : [stretch, 1, 1],
      wide: long * stretch,
    };
  }

  static slot(member: CastMember3D, cast: readonly CastMember3D[], seat: PropPlace): number {
    const order = [...cast].sort((a, b) => StageSpots.PLACES[a.place] - StageSpots.PLACES[b.place]);
    const space = Math.min(StageSpots.SEAT_SPACE, seat.wide / Math.max(1, order.length));
    return seat.x + (order.indexOf(member) - (order.length - 1) / 2) * space;
  }
}

export class Stage3DMemory {
  static start(set: Skit3DSet): Stage3DState {
    return Object.fromEntries(
      set.cast.map((member) => [member.id, { place: member.enters ? OFF : member.place, rest: "idle" }]),
    );
  }

  static before(set: Skit3DSet, history: readonly Skit3DLine[]): Stage3DState {
    let state = Stage3DMemory.start(set);
    for (const line of history) state = Stage3DMemory.after(set, state, line);
    return state;
  }

  static after(set: Skit3DSet, state: Stage3DState, line: Skit3DLine): Stage3DState {
    const next: Stage3DState = { ...state };
    for (const member of set.cast) {
      const now = next[member.id];
      const act = Stage3DMemory.act(line, member.id);
      const entering = now.place === OFF && Stage3DMemory.joins(line, member, act?.move);
      const place = act?.move ?? (entering ? member.place : now.place);
      next[member.id] = { place, rest: Stage3DMemory.rest(now.rest, act?.act, act?.move) };
    }
    return next;
  }

  static props(set: Skit3DSet, lines: readonly Skit3DLine[]): PropPick[] {
    const gone = new Set(lines.flatMap((line) => line.gone ?? []));
    return (set.props ?? []).filter((pick) => !gone.has(pick.kind));
  }

  static rest(now: Rest, act: Action | undefined, move: Move | undefined): Rest {
    if (move) return "idle";
    if (!act) return now;
    return Stage3DMemory.held(act) ? act : "idle";
  }

  static held(act: string): act is (typeof HELD)[number] {
    return (HELD as readonly string[]).includes(act);
  }

  static act(line: Skit3DLine, id: string) {
    return (line.acts ?? []).find((act) => act.who === id);
  }

  static joins(line: Skit3DLine, member: CastMember3D, move: Move | undefined): boolean {
    if (move) return false;
    return line.speaker === member.id || Stage3DMemory.act(line, member.id) !== undefined;
  }
}
