import type { Board } from "../spec.ts";
import type { Stage } from "../stage.ts";
import { type Box, SurfaceSplit } from "../timeline.ts";
import { DiagramLayout } from "./layout.ts";
import type { StageNode } from "./spec.ts";
import { DiagramMemory, DiagramScript } from "./state.ts";

export interface DiagramPlan {
  script: DiagramScript;
  boxes: Map<string, Box>;
  /** Where the previous scene left its nodes, when it showed the diagram too. */
  from: Map<string, Box> | null;
  wide: boolean;
  fromWide: boolean;
  band: Box;
  area: Box;
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
    const { band, area } = SurfaceSplit.of(board, content);
    const last = history.at(-1);
    let from: Map<string, Box> | null = null;
    let fromWide = DiagramLayout.wide(area);
    if (last && DiagramMemory.isDiagram(last)) {
      const before = new DiagramScript(
        DiagramMemory.before(history.slice(0, -1)),
        last.beats,
        last.beats.map(() => 0),
        1,
      );
      const earlier = SurfaceSplit.of(last, content).area;
      from = DiagramLayout.of(before.order, before.arrows, earlier);
      fromWide = DiagramLayout.wide(earlier);
    }
    return {
      script,
      boxes: DiagramLayout.of(script.order, script.arrows, area),
      from,
      wide: DiagramLayout.wide(area),
      fromWide,
      band,
      area,
    };
  }

  static stage(stage: Stage | null | undefined): Map<string, StageNode> {
    return new Map((stage?.nodes ?? []).map((node) => [node.id, node]));
  }
}
