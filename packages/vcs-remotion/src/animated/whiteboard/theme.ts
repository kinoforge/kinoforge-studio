import type { WbInk, WbTheme, WbTone } from "./spec.ts";

export interface WbPalette {
  board: string;
  grain: number;
  inks: Record<WbInk, string>;
  washes: readonly string[];
  marker: { body: string; band: string };
}

const PALETTES: Record<WbTheme, WbPalette> = {
  whiteboard: {
    board: "#fbfaf6",
    grain: 0.05,
    inks: { ink: "#1f2329", blue: "#2457c5", red: "#d23b2e", green: "#1d8f50", orange: "#dd7a12" },
    washes: ["#ffe58f", "#bfe0ff", "#ffcdc4", "#c8efd4", "#e4d4ff"],
    marker: { body: "#f2f2ee", band: "#1f2329" },
  },
  chalkboard: {
    board: "#24362d",
    grain: 0.12,
    inks: { ink: "#f3f0e6", blue: "#8fc4ff", red: "#ff9a8f", green: "#9ee6a6", orange: "#ffd27a" },
    washes: ["#4d6b3f", "#36586b", "#6b4440", "#3f6b55", "#56486b"],
    marker: { body: "#f3f0e6", band: "#c9c4b4" },
  },
};

const TONES: Record<WbTone, WbInk> = { good: "green", bad: "red", warn: "orange" };

export class WbPalettes {
  static of(theme: WbTheme): WbPalette {
    return PALETTES[theme] ?? PALETTES.whiteboard;
  }

  static tone(tone: WbTone): WbInk {
    return TONES[tone];
  }
}
