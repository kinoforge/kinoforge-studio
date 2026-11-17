import {
  type Action,
  type CastMember3D,
  HELD,
  type Move,
  OFF,
  type Place,
  type Rest,
  type Skit3DLine,
  type Skit3DSet,
  type Spot,
} from "./spec.ts";

export interface Member3DState {
  place: Move;
  rest: Rest;
}

export type Stage3DState = Record<string, Member3DState>;

export class StageSpots {
  static readonly GAP = 1.7;
  static readonly TALL_GAP = 1.05;
  static readonly ENTRY = 2.8;
  static readonly PLACES: Record<Place, number> = {
    far_left: -2,
    left: -1,
    center: 0,
    right: 1,
    far_right: 2,
  };
  static readonly SPOTS: Record<Spot, [number, number]> = {
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
    return [across * gap, depth];
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
