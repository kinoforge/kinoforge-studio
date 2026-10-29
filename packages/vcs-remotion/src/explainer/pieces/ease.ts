import type { PieceOf, PieceType } from "../spec.ts";
import type { BoardPalette } from "../theme.ts";

/** What a piece view draws from: its data, its card's inner size, seconds since it showed,
 *  and how long until the next beat (the time its own animation may take). */
export interface PieceProps<T extends PieceType> {
  piece: PieceOf<T>;
  w: number;
  h: number;
  t: number;
  span: number;
  palette: BoardPalette;
}

export class Ease {
  static clamp(x: number): number {
    return Math.min(1, Math.max(0, x));
  }

  /** 0 to 1 over `duration` seconds after `delay`, slowing at the end. */
  static out(t: number, duration: number, delay = 0): number {
    const x = Ease.clamp((t - delay) / Math.max(0.001, duration));
    return 1 - (1 - x) ** 3;
  }

  /** 0 to 1 with a small overshoot, for things that pop in. */
  static pop(t: number, duration: number, delay = 0): number {
    const x = Ease.clamp((t - delay) / Math.max(0.001, duration));
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
  }

  /** When item `index` of `count` shows, spread over most of the beat. */
  static stagger(index: number, count: number, span: number): number {
    const step = Math.min(0.7, Math.max(0.25, (span * 0.75) / Math.max(1, count)));
    return 0.2 + index * step;
  }
}
