import { HAND_FONT_DATA, HAND_WIDTHS } from "./data.ts";

export type HandWeight = "regular" | "bold";

export interface HandBlock {
  size: number;
  lines: string[];
  width: number;
  height: number;
}

export class HandFont {
  static readonly FAMILY = "WhiteboardHand";
  static readonly LEADING = 1.18;
  static readonly FALLBACK = 560;
  private static readonly tables = {
    regular: HandFont.table(HAND_WIDTHS.regular),
    bold: HandFont.table(HAND_WIDTHS.bold),
  };
  private static loading: Promise<void> | null = null;

  static css(weight: HandWeight): { fontFamily: string; fontWeight: number } {
    return { fontFamily: `"${HandFont.FAMILY}", "DejaVu Sans", sans-serif`, fontWeight: weight === "bold" ? 700 : 400 };
  }

  static load(): Promise<void> {
    if (typeof document === "undefined" || typeof FontFace === "undefined") return Promise.resolve();
    HandFont.loading ??= Promise.all(
      (["regular", "bold"] as const).map(async (weight) => {
        const face = new FontFace(HandFont.FAMILY, `url(${HAND_FONT_DATA[weight]})`, {
          weight: weight === "bold" ? "700" : "400",
        });
        await face.load();
        document.fonts.add(face);
      }),
    ).then(() => undefined);
    return HandFont.loading;
  }

  static width(text: string, size: number, weight: HandWeight = "regular"): number {
    const table = HandFont.tables[weight];
    let units = 0;
    for (const char of text) units += table.get(char.codePointAt(0) ?? 32) ?? HandFont.FALLBACK;
    return (units / 1000) * size;
  }

  static wrap(text: string, width: number, size: number, weight: HandWeight = "regular"): string[] {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && HandFont.width(next, size, weight) > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  static fit(
    text: string,
    box: { w: number; h: number },
    most: number,
    weight: HandWeight = "regular",
    maxLines = 4,
  ): HandBlock {
    const least = Math.max(10, most * 0.3);
    for (let size = most; size >= least; size *= 0.94) {
      const block = HandFont.block(text, box.w, size, weight);
      if (block.lines.length <= maxLines && block.height <= box.h && block.width <= box.w) return block;
    }
    return HandFont.block(text, box.w, least, weight);
  }

  static block(text: string, width: number, size: number, weight: HandWeight): HandBlock {
    const lines = HandFont.wrap(text, width, size, weight);
    return {
      size,
      lines,
      width: Math.max(0, ...lines.map((line) => HandFont.width(line, size, weight))),
      height: lines.length * size * HandFont.LEADING,
    };
  }

  private static table(rows: readonly (readonly [number, string])[]): Map<number, number> {
    const out = new Map<number, number>();
    for (const [start, widths] of rows) widths.split(" ").forEach((w, i) => out.set(start + i, Number(w)));
    return out;
  }
}
