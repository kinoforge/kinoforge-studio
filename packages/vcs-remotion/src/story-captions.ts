import type { CaptionWord } from "./captions.ts";
import { GlyphWidths } from "./explainer/metrics.ts";

/** Story caption layout shared by every renderer (the Remotion composition and the ffmpeg
 *  lane's ASS subtitles), so line breaks, size and safe margins match across both. */

export const CAPTION_POSITIONS = ["bottom", "middle", "top"] as const;
export type CaptionPosition = (typeof CAPTION_POSITIONS)[number];

export class CaptionPlacement {
  static of(value: unknown): CaptionPosition | undefined {
    return CAPTION_POSITIONS.find((position) => position === value);
  }
}

export const DEFAULT_CAPTION_COLOR = "#FFD84D";

export type CaptionLine = { words: CaptionWord[]; start: number; end: number };

export class CaptionLines {
  static readonly ENDS = /[.!?…。！？]["'”’)]*$/;

  static build(words: CaptionWord[], lineEms: number): CaptionLine[] {
    const lines: CaptionLine[] = [];
    const space = CaptionLines.ems(" ");
    let current: CaptionWord[] = [];
    let length = 0;
    for (const entry of words) {
      const word = (entry.word || "").trim();
      if (!word) continue;
      const size = CaptionLines.ems(word);
      const candidate = current.length ? length + space + size : size;
      if (current.length && candidate > lineEms) {
        lines.push(CaptionLines.line(current));
        current = [{ ...entry, word }];
        length = size;
      } else {
        current.push({ ...entry, word });
        length = candidate;
      }
      if (CaptionLines.ENDS.test(word)) {
        lines.push(CaptionLines.line(current));
        current = [];
        length = 0;
      }
    }
    if (current.length) lines.push(CaptionLines.line(current));
    return lines;
  }

  static ems(text: string): number {
    let total = 0;
    for (const char of text) total += GlyphWidths.of(char.codePointAt(0) ?? 0, "sans");
    return total;
  }

  static activeAt(lines: CaptionLine[], seconds: number): CaptionLine | undefined {
    let active: CaptionLine | undefined;
    for (const line of lines) {
      if (line.start > seconds) break;
      active = line;
    }
    return active;
  }

  private static line(words: CaptionWord[]): CaptionLine {
    return { words, start: words[0].start, end: words[words.length - 1].end };
  }
}

/** Keeps captions clear of the chrome Shorts, Reels and TikTok draw over a vertical frame:
 *  the caption, buttons and progress bar along the bottom, the action rail on the right, the
 *  header on top. Landscape frames have little overlay and keep slim margins. */
export class CaptionSafeArea {
  static insets(position: CaptionPosition, width: number, height: number) {
    const vertical = height > width;
    return {
      left: width * 0.07,
      right: width * (vertical ? 0.15 : 0.07),
      top: position === "top" ? height * (vertical ? 0.16 : 0.08) : 0,
      bottom: position === "bottom" ? height * (vertical ? 0.1 : 0.08) : 0,
    };
  }

  static justify(position: CaptionPosition): "flex-start" | "center" | "flex-end" {
    return position === "top" ? "flex-start" : position === "middle" ? "center" : "flex-end";
  }
}

export class CaptionLayout {
  static of(width: number, height: number, scale: number, position: CaptionPosition) {
    const fontSize = Math.round(height * 0.052 * (scale || 1));
    const inset = CaptionSafeArea.insets(position, width, height);
    const stroke = Math.max(1, Math.round(fontSize * 0.03));
    const lineWidth = width - inset.left - inset.right - stroke * 4;
    return {
      fontSize,
      inset,
      lineEms: Math.max(4, lineWidth / fontSize),
      stroke,
    };
  }
}
