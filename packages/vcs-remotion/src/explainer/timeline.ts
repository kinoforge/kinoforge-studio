import type { CaptionWord } from "../captions.ts";
import { type Beat, type CaptionReserve, PIECE_KINDS } from "./spec.ts";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** When each beat shows: at its cue's first spoken word (a little ahead of it), in order. A
 *  cue the voice never says, or a scene with no voice, spreads evenly between its neighbours. */
export class BoardCues {
  static readonly LEAD = 0.15;

  static resolve(beats: readonly Beat[], words: readonly CaptionWord[], seconds: number): number[] {
    const tokens = words.map((word) => BoardCues.normal(word.word));
    const found: (number | null)[] = [];
    let cursor = 0;
    for (const beat of beats) {
      const at = BoardCues.find(tokens, BoardCues.tokens(beat.cue), cursor);
      if (at < 0) {
        found.push(null);
        continue;
      }
      found.push(Math.max(0, words[at].start - BoardCues.LEAD));
      cursor = at + 1;
    }
    return BoardCues.fill(found, seconds);
  }

  static tokens(text: string): string[] {
    return text.split(/\s+/).map((word) => BoardCues.normal(word)).filter(Boolean);
  }

  private static normal(word: string): string {
    return (word || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  }

  private static find(tokens: string[], cue: string[], from: number): number {
    if (!cue.length) return -1;
    for (const size of [cue.length, 1]) {
      const wanted = cue.slice(0, size);
      for (let i = from; i + size <= tokens.length; i++) {
        if (wanted.every((token, k) => tokens[i + k] === token)) return i;
      }
    }
    return -1;
  }

  private static fill(found: (number | null)[], seconds: number): number[] {
    const end = Math.max(0.5, seconds * 0.85);
    const out = [...found];
    if (out[0] == null) out[0] = 0;
    for (let i = 1; i < out.length; i++) {
      if (out[i] != null) {
        out[i] = Math.max(out[i] as number, out[i - 1] as number);
        continue;
      }
      let next = i;
      while (next < out.length && out[next] == null) next++;
      const from = out[i - 1] as number;
      const to = next < out.length ? (out[next] as number) : end;
      out[i] = from + (Math.max(to, from) - from) / (next - i + 1);
    }
    return out as number[];
  }
}

/** One frame shape's layout, as shares of its width and height. */
interface FrameSpec {
  /** Top edge: clear of the platform header, or of captions on top. */
  top: number;
  topCaptions: number;
  /** Bottom edge: clear of the platform bar, or of captions at the bottom. */
  floor: number;
  floorCaptions: number;
  left: number;
  width: number;
  /** The board's width with a mascot beside it. */
  widthBeside: number;
  mascotHeight: number;
  mascotLeft: number;
  /** The mascot stands beside the board (wide frames) or under it (tall frames). */
  mascotAside: boolean;
  /** Space between the board and a mascot under it. */
  gap: number;
  /** How much piece weight fits on the board at once. */
  capacity: number;
}

const FRAMES: Record<"tall" | "wide", FrameSpec> = {
  tall: {
    top: 0.09,
    topCaptions: 0.22,
    floor: 0.9,
    floorCaptions: 0.76,
    left: 0.07,
    width: 0.81,
    widthBeside: 0.81,
    mascotHeight: 0.2,
    mascotLeft: 0.05,
    mascotAside: false,
    gap: 0.01,
    capacity: 3.4,
  },
  wide: {
    top: 0.08,
    topCaptions: 0.2,
    floor: 0.92,
    floorCaptions: 0.78,
    left: 0.06,
    width: 0.88,
    widthBeside: 0.64,
    mascotHeight: 0.44,
    mascotLeft: 0.74,
    mascotAside: true,
    gap: 0,
    capacity: 2.8,
  },
};

/** A mascot's width to its height. */
const MASCOT_ASPECT = 0.9;

/** Where the board and the mascot sit: clear of the platform chrome and the caption band. */
export class BoardLayout {
  static of(width: number, height: number, reserve: CaptionReserve, mascot: boolean) {
    const spec = FRAMES[height > width ? "tall" : "wide"];
    const top = height * (reserve === "top" ? spec.topCaptions : spec.top);
    const floor = height * (reserve === "bottom" ? spec.floorCaptions : spec.floor);
    const mascotH = mascot ? height * spec.mascotHeight : 0;
    const under = mascot && !spec.mascotAside ? mascotH + height * spec.gap : 0;
    const content: Box = {
      x: width * spec.left,
      y: top,
      w: width * (mascot ? spec.widthBeside : spec.width),
      h: floor - top - under,
    };
    const figure: Box | null = mascot
      ? { x: width * spec.mascotLeft, y: floor - mascotH, w: mascotH * MASCOT_ASPECT, h: mascotH }
      : null;
    return { content, mascot: figure, capacity: spec.capacity };
  }
}

/** Which pieces are on the board after each beat, and where each one stands. */
export class BoardStack {
  static readonly GAP = 0.045;

  /** The ids on the board once beat `index` has shown, oldest first. */
  static visible(beats: readonly Beat[], index: number, capacity: number): number[] {
    let shown: number[] = [];
    for (let i = 0; i <= index; i++) {
      if (beats[i].clear) shown = [];
      if (PIECE_KINDS[beats[i].piece.type].layer === "card") shown.push(i);
      while (shown.length > 1 && BoardStack.weight(beats, shown) > capacity) shown.shift();
    }
    return shown;
  }

  static boxes(beats: readonly Beat[], shown: number[], area: Box): Map<number, Box> {
    const out = new Map<number, Box>();
    if (!shown.length) return out;
    const gap = area.h * BoardStack.GAP;
    const total = BoardStack.weight(beats, shown);
    const unit = (area.h - gap * (shown.length - 1)) / Math.max(total, 2.2);
    const used = unit * total + gap * (shown.length - 1);
    let y = area.y + (area.h - used) / 2;
    for (const id of shown) {
      const h = unit * PIECE_KINDS[beats[id].piece.type].weight;
      out.set(id, { x: area.x, y, w: area.w, h });
      y += h + gap;
    }
    return out;
  }

  private static weight(beats: readonly Beat[], ids: number[]): number {
    return ids.reduce((sum, id) => sum + PIECE_KINDS[beats[id].piece.type].weight, 0);
  }
}

/** A font size that fits text into a box, from its length (no DOM measuring at render). The
 *  widths are those of the bold fallback faces the renderer has (DejaVu), the widest in use. */
export class FitText {
  static readonly SANS = 0.64;
  static readonly MONO = 0.62;

  static size(
    text: string,
    box: { w: number; h: number },
    max: number,
    lines = 3,
    charWidth = FitText.SANS,
  ): number {
    const chars = Math.max(1, text.length);
    const word = Math.max(1, ...text.split(/\s+/).map((part) => part.length));
    for (let size = max; size > 12; size -= 2) {
      const glyph = size * charWidth;
      const perLine = Math.max(1, Math.floor(box.w / glyph));
      const needed = Math.ceil((chars * 1.08) / perLine);
      if (word * glyph <= box.w && needed <= lines && needed * size * 1.2 <= box.h) return size;
    }
    return 12;
  }
}
