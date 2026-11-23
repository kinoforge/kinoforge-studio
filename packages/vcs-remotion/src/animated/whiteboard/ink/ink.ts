import type { HandWeight } from "../hand/font.ts";
import { type Point, Polyline } from "./path.ts";

export interface Place {
  x: number;
  y: number;
  s: number;
}

interface Timed {
  from: number;
  to: number;
}

export interface LineInk extends Timed {
  kind: "line";
  d: string;
  path: Polyline;
  width: number;
  color: string;
  place?: Place;
}

export interface FillInk extends Timed {
  kind: "fill";
  d: string;
  color: string;
  opacity: number;
  evenodd?: boolean;
  place?: Place;
}

export interface TextInk extends Timed {
  kind: "text";
  x: number;
  y: number;
  size: number;
  weight: HandWeight;
  lines: string[];
  widths: number[];
  color: string;
  align: "middle" | "start";
  count?: { from: number; to: number; decimals: number; prefix: string; suffix: string };
}

export interface DotInk extends Timed {
  kind: "dot";
  path: Polyline;
  r: number;
  color: string;
  halo: string;
  label?: { text: string; size: number; width: number };
}

export type Ink = LineInk | FillInk | TextInk | DotInk;
export type InkDraft = (Omit<LineInk, "from" | "to"> | Omit<FillInk, "from" | "to"> | Omit<TextInk, "from" | "to"> | Omit<DotInk, "from" | "to">) & {
  cost: number;
  with?: boolean;
};

export class Inks {
  static line(parts: readonly (readonly Point[])[], width: number, color: string, speed: number): InkDraft {
    const path = new Polyline(parts);
    return {
      kind: "line",
      d: parts.map((part) => Polyline.d(part)).join(""),
      path,
      width,
      color,
      cost: Inks.clamp(path.length / speed, 0.12, 1.1),
    };
  }

  static glyphLine(d: string, parts: readonly (readonly Point[])[], width: number, color: string, place: Place, speed: number): InkDraft {
    const path = new Polyline(parts.map((part) => part.map(([x, y]) => [place.x + x * place.s, place.y + y * place.s] as const)));
    return { kind: "line", d, path, width, color, place, cost: Inks.clamp(path.length / speed, 0.05, 0.6) };
  }

  static fill(d: string, color: string, opacity: number, cost = 0.28, place?: Place, evenodd?: boolean): InkDraft {
    return { kind: "fill", d, color, opacity, cost, place, evenodd };
  }

  static text(
    lines: string[],
    widths: number[],
    x: number,
    y: number,
    size: number,
    weight: HandWeight,
    color: string,
    align: "middle" | "start" = "middle",
  ): InkDraft {
    const chars = lines.join("").length;
    const rate = weight === "bold" ? 17 : 21;
    return { kind: "text", lines, widths, x, y, size, weight, color, align, cost: Inks.clamp(chars / rate, 0.25, 2.4) };
  }

  static clamp(value: number, low: number, high: number): number {
    return Math.min(high, Math.max(low, value));
  }
}
