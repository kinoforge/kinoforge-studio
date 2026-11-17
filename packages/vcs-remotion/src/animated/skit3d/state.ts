import { type CastMember3D, type Move, OFF, type Place, type Skit3DLine, type Skit3DSet, type Spot } from "./spec.ts";

export interface Member3DState {
  place: Move;
  sits: boolean;
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
    back_left: [-3.4, -2.6],
    back_center: [0, -2.9],
    back_right: [3.4, -2.6],
    side_left: [-5, -1],
    side_right: [5, -1],
    front_left: [-4.2, 1.6],
    front_right: [4.2, 1.6],
  };

  static x(place: Place, gap: number): number {
    return StageSpots.PLACES[place] * gap;
  }

  static wing(home: Place, from: number): number {
    return from + (Math.sign(StageSpots.PLACES[home]) || -1) * StageSpots.ENTRY;
  }

  static spot(spot: Spot): [number, number] {
    return StageSpots.SPOTS[spot];
  }
}

export class Stage3DMemory {
  static start(set: Skit3DSet): Stage3DState {
    return Object.fromEntries(
      set.cast.map((member) => [member.id, { place: member.enters ? OFF : member.place, sits: false }]),
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
      const sits = act?.move ? false : act?.act === "sit" ? true : act?.act ? false : now.sits;
      next[member.id] = { place, sits };
    }
    return next;
  }

  static act(line: Skit3DLine, id: string) {
    return (line.acts ?? []).find((act) => act.who === id);
  }

  static joins(line: Skit3DLine, member: CastMember3D, move: Move | undefined): boolean {
    if (move) return false;
    return line.speaker === member.id || Stage3DMemory.act(line, member.id) !== undefined;
  }
}
