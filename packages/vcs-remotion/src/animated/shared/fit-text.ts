import type { CSSProperties } from "react";
import { GlyphWidths, type TextFace } from "./metrics.ts";

export interface FitMiss {
  text: string;
  room: number;
}

export class FitText {
  static readonly MONO = GlyphWidths.MONO;
  static readonly LEADING = 1.25;
  static readonly SAFETY = 1.04;
  static readonly SMALLEST = 12;
  static readonly READABLE = 26;
  static readonly WORD = 24;
  private static misses: FitMiss[] | null = null;

  static width(text: string, size: number, face: TextFace = "sans"): number {
    let sum = 0;
    for (const char of text) sum += GlyphWidths.of(char.codePointAt(0) ?? 32, face);
    return sum * size * FitText.SAFETY;
  }

  static each(
    texts: readonly string[],
    box: { w: number; h: number },
    max: number,
    lines = 3,
    face: TextFace = "sans",
  ): number {
    return texts.reduce(
      (least, text) => Math.min(least, FitText.size(text, box, max, lines, face)),
      max,
    );
  }

  static lines(text: string, w: number, size: number, face: TextFace = "sans"): number {
    const space = FitText.width(" ", size, face);
    let lines = 1;
    let used = 0;
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const wide = FitText.width(word, size, face);
      const need = used ? used + space + wide : wide;
      if (need <= w) {
        used = need;
        continue;
      }
      if (used) lines += 1;
      const extra = Math.max(0, Math.ceil(wide / w) - 1);
      lines += extra;
      used = wide - extra * w;
    }
    return lines;
  }

  static size(
    text: string,
    box: { w: number; h: number },
    max: number,
    lines = 3,
    face: TextFace = "sans",
  ): number {
    if (!text.trim()) return max;
    const whole = text.split(/\s+/).filter((word) => FitText.whole(word, face));
    const fits = (size: number) => {
      if (whole.some((word) => FitText.width(word, size, face) > box.w)) return false;
      const count = FitText.lines(text, box.w, size, face);
      return count <= lines && count * size * FitText.LEADING <= box.h;
    };
    const step = Math.max(1, Math.round(max / 48));
    let size = max;
    while (size > FitText.SMALLEST && !fits(size)) size = Math.max(FitText.SMALLEST, size - step);
    const readable = FitText.readable(max);
    if (size < readable || !fits(size)) FitText.miss(text, box, readable, lines, face);
    return size;
  }

  static clamp(lines: number): CSSProperties {
    return {
      display: "-webkit-box",
      WebkitLineClamp: lines,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
      overflowWrap: "anywhere",
    };
  }

  static line(): CSSProperties {
    return { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" };
  }

  static watch(run: () => void): FitMiss[] {
    FitText.misses = [];
    try {
      run();
      return FitText.misses;
    } finally {
      FitText.misses = null;
    }
  }

  private static whole(word: string, face: TextFace): boolean {
    const chars = Array.from(word);
    return (
      chars.length <= FitText.WORD &&
      chars.every((char) => GlyphWidths.of(char.codePointAt(0) ?? 32, face) < 1)
    );
  }

  private static readable(max: number): number {
    return Math.max(FitText.SMALLEST, Math.min(FitText.READABLE, max * 0.75));
  }

  private static miss(
    text: string,
    box: { w: number; h: number },
    size: number,
    lines: number,
    face: TextFace,
  ): void {
    if (!FitText.misses) return;
    const rows = Math.max(1, Math.min(lines, Math.floor(box.h / (size * FitText.LEADING))));
    const share = (rows * box.w * 0.9) / Math.max(1, FitText.width(text, size, face));
    const room = Math.max(1, Math.floor(Array.from(text).length * Math.min(1, share)));
    if (!FitText.misses.some((miss) => miss.text === text)) FitText.misses.push({ text, room });
  }
}
