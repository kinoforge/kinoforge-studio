import { type Board, PIECE_KINDS } from "../spec.ts";
import type { Box } from "../timeline.ts";
import { DiagramLayout } from "./layout.ts";
import type { Stage, StageNode } from "./spec.ts";
import { DiagramMemory, DiagramScript } from "./state.ts";

/** A diagram scene's split of the board: a band on top for its cards, the diagram below. */
const BAND = { share: 0.26, gap: 0.04 };

export interface DiagramPlan {
  script: DiagramScript;
  boxes: Map<string, Box>;
  /** Where the previous scene left its nodes, when it showed the diagram too. */
  from: Map<string, Box> | null;
  band: Box;
}

export class DiagramScene {
  /** The plan for a board that draws on the diagram, else null (a board of cards only). */
  static of(
    board: Board,
    starts: readonly number[],
    seconds: number,
    history: readonly Board[],
    content: Box,
  ): DiagramPlan | null {
    if (!DiagramMemory.isDiagram(board)) return null;
    const script = new DiagramScript(DiagramMemory.before(history), board.beats, starts, seconds);
    const { band, area } = DiagramScene.split(board, content);
    const last = history.at(-1);
    let from: Map<string, Box> | null = null;
    if (last && DiagramMemory.isDiagram(last)) {
      const before = new DiagramScript(
        DiagramMemory.before(history.slice(0, -1)),
        last.beats,
        last.beats.map(() => 0),
        1,
      );
      from = DiagramLayout.of(before.order, before.arrows, DiagramScene.split(last, content).area);
    }
    return { script, boxes: DiagramLayout.of(script.order, script.arrows, area), from, band };
  }

  static stage(stage: Stage | null | undefined): Map<string, StageNode> {
    return new Map((stage?.nodes ?? []).map((node) => [node.id, node]));
  }

  private static split(board: Board, content: Box): { band: Box; area: Box } {
    const cards = board.beats.some((beat) => PIECE_KINDS[beat.piece.type].layer === "card");
    const bandH = cards ? content.h * BAND.share : 0;
    const gap = cards ? content.h * BAND.gap : 0;
    return {
      band: { ...content, h: bandH },
      area: { ...content, y: content.y + bandH + gap, h: content.h - bandH - gap },
    };
  }
}
