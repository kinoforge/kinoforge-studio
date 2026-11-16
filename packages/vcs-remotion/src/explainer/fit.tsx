import type { ReactElement } from "react";
import { z } from "zod";
import { BoardMoment } from "./composition.tsx";
import { type BoardElements, elementsSchema } from "./elements/spec.ts";
import {
  type Board,
  CAPTION_RESERVES,
  boardSchema,
  boardThemeSchema,
  mascotSchema,
} from "./spec.ts";
import { shownStageSchema } from "./stage.ts";
import { BoardCues, FitText } from "./timeline.ts";

export const fitRequestSchema = z.object({
  width: z.number().int().min(64).max(4096),
  height: z.number().int().min(64).max(4096),
  reserve: z.enum(CAPTION_RESERVES).default("bottom"),
  theme: boardThemeSchema.optional(),
  mascot: mascotSchema.nullable().optional(),
  language: z.string().max(16).optional(),
  stage: z.unknown().optional(),
  elements: z.unknown().optional(),
  boards: z.array(z.unknown().nullable()).max(200),
  check: z.array(z.number().int().min(0)).max(200),
});
export type FitRequest = z.infer<typeof fitRequestSchema>;
type Render = (element: ReactElement) => string;

export class BoardFit {
  static readonly BEAT_SECONDS = 4;
  static readonly SETTLE = 0.05;

  static check(request: FitRequest, render: Render): Record<number, string[]> {
    const boards = request.boards.map((board) => {
      const parsed = boardSchema.safeParse(board);
      return parsed.success ? parsed.data : null;
    });
    const stage = shownStageSchema.safeParse(request.stage);
    const elements = elementsSchema.safeParse(request.elements ?? {});
    const out: Record<number, string[]> = {};
    for (const index of new Set(request.check)) {
      const board = boards[index];
      if (!board) continue;
      const history = boards.slice(0, index).filter((b): b is Board => b != null);
      const problems = BoardFit.problems(
        board,
        history,
        request,
        stage.success ? stage.data : null,
        elements.success ? elements.data : {},
        render,
      );
      if (problems.length) out[index] = problems;
    }
    return out;
  }

  private static problems(
    board: Board,
    history: Board[],
    request: FitRequest,
    stage: z.infer<typeof shownStageSchema> | null,
    elements: BoardElements,
    render: Render,
  ): string[] {
    const seconds = board.beats.length * BoardFit.BEAT_SECONDS;
    const starts = BoardCues.resolve(board.beats, [], seconds);
    const props = {
      fps: 30,
      width: request.width,
      height: request.height,
      seconds,
      board,
      words: [],
      theme: request.theme,
      mascot: request.mascot ?? null,
      reserve: request.reserve,
      stage,
      history,
      language: request.language,
      elements,
    };
    const misses = FitText.watch(() => {
      board.beats.forEach((_, i) => {
        const t = (starts[i + 1] ?? seconds) - BoardFit.SETTLE;
        render(<BoardMoment {...props} t={t} />);
      });
    });
    const shape = BoardFit.shape(request.width, request.height);
    return misses.flatMap((miss) => {
      const where = BoardFit.where(board, miss.text);
      return where
        ? [`${where}: too long to read on a ${shape} frame; keep it under ${miss.room} characters`]
        : [];
    });
  }

  private static where(board: Board, text: string): string | null {
    const leaves: [string, string][] = [];
    const walk = (value: unknown, path: string) => {
      if (typeof value === "string") leaves.push([path, value]);
      else if (Array.isArray(value)) value.forEach((item, i) => walk(item, `${path}[${i}]`));
      else if (value && typeof value === "object") {
        for (const [key, item] of Object.entries(value)) {
          if (key !== "cue" && key !== "type") walk(item, `${path}.${key}`);
        }
      }
    };
    board.beats.forEach((beat, i) => walk(beat.piece, `beats[${i}].piece`));
    const exact = leaves.find(([, value]) => value === text);
    if (exact) return exact[0];
    const inside = leaves.find(([, value]) => value.length > 3 && text.includes(value));
    return inside ? inside[0] : null;
  }

  private static shape(width: number, height: number): string {
    if (height > width) return "vertical";
    return width > height ? "wide" : "square";
  }
}
