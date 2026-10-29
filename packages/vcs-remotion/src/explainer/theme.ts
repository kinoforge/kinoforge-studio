export const BOARD_THEMES = ["paper", "chalk", "night", "blueprint"] as const;
export type BoardTheme = (typeof BOARD_THEMES)[number];

export const BOARD_PATTERNS = ["fibers", "dust", "dots", "grid"] as const;
export type BoardPattern = (typeof BOARD_PATTERNS)[number];

export interface BoardPalette {
  background: string;
  pattern: BoardPattern;
  ink: string;
  muted: string;
  card: string;
  cardInk: string;
  accent: string;
  accent2: string;
  good: string;
  bad: string;
  warn: string;
  shadow: string;
  tape: boolean;
  light: boolean;
}

export const BOARD_FONT = '"Archivo", "Inter", "DejaVu Sans", "Noto Sans", sans-serif';
export const BOARD_MONO = '"DejaVu Sans Mono", "Noto Sans Mono", ui-monospace, monospace';

const PALETTES: Record<BoardTheme, BoardPalette> = {
  paper: {
    background: "#F2E9DA",
    pattern: "fibers",
    ink: "#1F1B16",
    muted: "#6B5F52",
    card: "#FFFDF7",
    cardInk: "#1F1B16",
    accent: "#E4572E",
    accent2: "#2E86AB",
    good: "#2F9E5B",
    bad: "#D7263D",
    warn: "#E8A317",
    shadow: "rgba(70, 45, 20, 0.28)",
    tape: true,
    light: true,
  },
  chalk: {
    background: "#1E3A2D",
    pattern: "dust",
    ink: "#F2F1E6",
    muted: "#B9C4B3",
    card: "#264736",
    cardInk: "#F2F1E6",
    accent: "#F6C945",
    accent2: "#8FD3F4",
    good: "#9BE08A",
    bad: "#FF8A80",
    warn: "#FFD180",
    shadow: "rgba(0, 0, 0, 0.35)",
    tape: false,
    light: false,
  },
  night: {
    background: "#0E1120",
    pattern: "dots",
    ink: "#F3F4F8",
    muted: "#9AA0B8",
    card: "#1A2036",
    cardInk: "#F3F4F8",
    accent: "#8B6CFF",
    accent2: "#22D3EE",
    good: "#34D399",
    bad: "#FB7185",
    warn: "#FBBF24",
    shadow: "rgba(0, 0, 0, 0.5)",
    tape: false,
    light: false,
  },
  blueprint: {
    background: "#123A6B",
    pattern: "grid",
    ink: "#EAF2FF",
    muted: "#A9C1E6",
    card: "#17487F",
    cardInk: "#EAF2FF",
    accent: "#FFD166",
    accent2: "#7FDBFF",
    good: "#7BE495",
    bad: "#FF8C8C",
    warn: "#FFD166",
    shadow: "rgba(0, 10, 30, 0.45)",
    tape: false,
    light: false,
  },
};

export class BoardThemes {
  static of(theme: BoardTheme | undefined): BoardPalette {
    return PALETTES[theme ?? "paper"] ?? PALETTES.paper;
  }
}
