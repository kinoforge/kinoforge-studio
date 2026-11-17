import type { CaptionReserve } from "../explainer/spec.ts";
import type { Shot } from "./spec.ts";

export interface Framed {
  x: number;
  tall: number;
}

export interface CameraPlace {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export class ShotPlanner {
  static readonly FOV = 34;
  static readonly BODY = 0.34;
  static readonly MARGIN = 0.25;
  static readonly ROOM = 1.1;
  static readonly SIDE = 0.22;
  static readonly PUSH = 0.06;
  static readonly LIFT = 0.1;
  static readonly SHIFT = 0.13;
  static readonly CLOSE_FROM = 0.22;
  static readonly HEAD_ROOM = 0.16;
  static readonly MOST_SEEN = 2.3;
  static readonly LEAN = 0.6;

  static pick(
    shot: Shot | undefined,
    walking: boolean,
    first: boolean,
    others: number,
    turn: number,
  ): Exclude<Shot, "auto"> {
    if (shot && shot !== "auto") return shot;
    if (others === 0) return "close";
    if (walking || first) return "wide";
    return turn % 2 === 0 ? "close" : "two";
  }

  static shift(reserve: CaptionReserve): number {
    return reserve === "top" ? -1 : 1;
  }

  static place(
    shot: Exclude<Shot, "auto">,
    subjects: readonly Framed[],
    side: number,
    aspect: number,
    reserve: CaptionReserve,
    progress: number,
  ): CameraPlace {
    const tallest = Math.max(...subjects.map((s) => s.tall));
    const top = tallest * (1 + ShotPlanner.HEAD_ROOM);
    const bottom = shot === "close" ? tallest * ShotPlanner.CLOSE_FROM : 0;
    const left = Math.min(...subjects.map((s) => s.x - s.tall * ShotPlanner.BODY)) - ShotPlanner.MARGIN;
    const right = Math.max(...subjects.map((s) => s.x + s.tall * ShotPlanner.BODY)) + ShotPlanner.MARGIN;
    const width = right - left;
    const height = top - bottom;
    const half = (ShotPlanner.FOV * Math.PI) / 360;
    const across = Math.atan(Math.tan(half) * aspect);
    const fits = Math.max(width / 2 / Math.tan(across), height / 2 / Math.tan(half)) * ShotPlanner.ROOM;
    const most = (ShotPlanner.MOST_SEEN * tallest) / 2 / Math.tan(half);
    const capped = fits > most;
    const distance = Math.min(fits, most) * (1 - ShotPlanner.PUSH * progress);
    const seen = 2 * distance * Math.tan(half);
    const spare = Math.max(0, seen - height) / 2;
    const middle = (left + right) / 2;
    const centre = capped ? middle + (subjects[0].x - middle) * ShotPlanner.LEAN : middle;
    const lookY =
      bottom + height / 2 - ShotPlanner.shift(reserve) * Math.min(spare, seen * ShotPlanner.SHIFT);
    const swing = shot === "wide" ? 0 : side * ShotPlanner.SIDE;
    return {
      position: [centre + swing * distance, lookY + distance * ShotPlanner.LIFT, distance],
      target: [centre, lookY, 0],
      fov: ShotPlanner.FOV,
    };
  }
}
