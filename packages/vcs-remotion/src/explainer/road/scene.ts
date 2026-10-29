import { type Board, PIECE_KINDS } from "../spec.ts";
import type { Stage } from "../stage.ts";
import { type Box, SurfaceSplit } from "../timeline.ts";
import type { TrafficSide } from "./spec.ts";
import { RoadMemory, RoadRules, RoadScript } from "./state.ts";

export interface RoadPlan {
  script: RoadScript;
  area: Box;
  /** Where the previous scene drew the road, when it showed the road too. */
  from: Box | null;
  band: Box;
  side: TrafficSide;
  /** A straight road on a wide frame runs across it: the learner drives to the right. */
  turned: boolean;
}

export class RoadScene {
  /** The plan for a board that drives on the road, else null. */
  static of(
    board: Board,
    starts: readonly number[],
    seconds: number,
    history: readonly Board[],
    content: Box,
    stage: Stage | null | undefined,
  ): RoadPlan | null {
    if (!RoadRules.isRoad(board)) return null;
    const side = stage?.road?.side ?? "right";
    // A road is square: on a wide frame its cards stand beside it.
    const aside = content.w > content.h * 1.2;
    const { band, area } = SurfaceSplit.of(board, content, aside);
    const unit = Math.min(area.w, area.h);
    const start = RoadMemory.before(history, side);
    const roads = board.beats.flatMap((beat) => (beat.piece.type === "road" ? [beat.piece] : []));
    // A first road opens the scene on its layout, with no other road before it.
    const first = board.beats.find((beat) => PIECE_KINDS[beat.piece.type].layer === "road");
    if (!history.some(RoadRules.isRoad) && first?.piece.type === "road") {
      RoadRules.apply(start, first.piece);
    }
    const turned =
      aside &&
      [start.layout, ...roads.map((road) => road.layout)].every((layout) => layout === "straight");
    const across = { x: area.w / unit / 2, y: area.h / unit / 2 };
    const script = new RoadScript(
      start,
      board.beats,
      starts,
      seconds,
      side,
      turned ? { x: across.y, y: across.x } : across,
    );
    const last = history.at(-1);
    const from = last && RoadRules.isRoad(last) ? SurfaceSplit.of(last, content, aside).area : null;
    return { script, area, from, band, side, turned };
  }
}
