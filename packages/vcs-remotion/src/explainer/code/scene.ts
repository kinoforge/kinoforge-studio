import type { Board } from "../spec.ts";
import type { Stage } from "../stage.ts";
import { type Box, FitText, SurfaceSplit } from "../timeline.ts";
import type { CodeFile } from "./spec.ts";
import { CodeMemory, CodeScript } from "./state.ts";

export interface CodePlan {
  script: CodeScript;
  area: Box;
  /** Where the previous scene drew the editor, when it showed code too. */
  from: Box | null;
  band: Box;
}

/** An editor's size for one file: sized to all its lines, so it holds still while they type. */
export class CodeLayout {
  static readonly LINE = 1.55;

  static of(file: CodeFile, area: Box) {
    const rows = Math.max(4, file.lines.length);
    const longest = Math.max(24, ...file.lines.map((line) => line.length));
    const digits = String(rows).length;
    const across = FitText.MONO * (longest + digits + 1.5) + 2;
    const down = 2.2 + rows * CodeLayout.LINE + 1.6;
    const size = Math.min(area.w / across, area.h / down, area.w * 0.05);
    const h = size * down;
    const w = Math.min(area.w, Math.max(area.w * 0.62, size * (across + 3)));
    return {
      box: { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h },
      size,
      bar: size * 2.2,
      gutter: size * FitText.MONO * (digits + 1.5),
      pad: size,
    };
  }
}

export class CodeScene {
  /** The plan for a board that writes code, else null. */
  static of(
    board: Board,
    starts: readonly number[],
    seconds: number,
    history: readonly Board[],
    content: Box,
    files: ReadonlyMap<string, CodeFile>,
  ): CodePlan | null {
    if (!CodeMemory.isCode(board)) return null;
    const script = new CodeScript(
      CodeMemory.before(history, files),
      files,
      board.beats,
      starts,
      seconds,
    );
    if (!script.sheets.length) return null;
    // A wide editor has room to spare across, not down: its cards stand beside it.
    const side = content.w > content.h * 1.2;
    const { band, area } = SurfaceSplit.of(board, content, side);
    const last = history.at(-1);
    const from = last && CodeMemory.isCode(last) ? SurfaceSplit.of(last, content, side).area : null;
    return { script, area, from, band };
  }

  static files(stage: Stage | null | undefined): Map<string, CodeFile> {
    return new Map((stage?.files ?? []).map((file) => [file.id, file]));
  }
}
