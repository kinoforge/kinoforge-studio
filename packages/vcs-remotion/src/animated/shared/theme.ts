export const BOARD_THEMES = [
  "paper",
  "chalk",
  "night",
  "blueprint",
  "sunset",
  "mint",
  "neon",
  "pastel",
] as const;
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
  glow: number;
}

export const BOARD_COLOR_KEYS = [
  "background",
  "ink",
  "muted",
  "card",
  "cardInk",
  "accent",
  "accent2",
] as const;
export type BoardColorKey = (typeof BOARD_COLOR_KEYS)[number];
export type BoardColors = Partial<Record<BoardColorKey, string>>;

export const BOARD_GLOWS = ["off", "soft", "normal", "strong"] as const;
export type BoardGlow = (typeof BOARD_GLOWS)[number];

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
    glow: 0.8,
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
    glow: 1,
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
    glow: 1,
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
    glow: 1,
  },
  sunset: {
    background: "#2A1426",
    pattern: "dots",
    ink: "#FFF1E8",
    muted: "#D8A7A0",
    card: "#3E1D36",
    cardInk: "#FFF1E8",
    accent: "#FF7A59",
    accent2: "#FFC857",
    good: "#7BD389",
    bad: "#FF5D73",
    warn: "#FFC857",
    shadow: "rgba(20, 0, 12, 0.5)",
    tape: false,
    light: false,
    glow: 1.1,
  },
  mint: {
    background: "#E4F3EC",
    pattern: "dots",
    ink: "#14302A",
    muted: "#55736A",
    card: "#FFFFFF",
    cardInk: "#14302A",
    accent: "#0F9D7A",
    accent2: "#3A6FF7",
    good: "#1E9E5A",
    bad: "#D64550",
    warn: "#D99A00",
    shadow: "rgba(10, 60, 40, 0.22)",
    tape: false,
    light: true,
    glow: 0.7,
  },
  neon: {
    background: "#07060F",
    pattern: "grid",
    ink: "#F5F3FF",
    muted: "#8E8AB5",
    card: "#141127",
    cardInk: "#F5F3FF",
    accent: "#FF2BD6",
    accent2: "#00F0FF",
    good: "#39FF88",
    bad: "#FF4D6D",
    warn: "#FFE14D",
    shadow: "rgba(0, 0, 0, 0.6)",
    tape: false,
    light: false,
    glow: 1.6,
  },
  pastel: {
    background: "#F6EDF5",
    pattern: "fibers",
    ink: "#2D2340",
    muted: "#7D6E91",
    card: "#FFFFFF",
    cardInk: "#2D2340",
    accent: "#A66CFF",
    accent2: "#3FA7D6",
    good: "#3FAE72",
    bad: "#E8506E",
    warn: "#E9A23B",
    shadow: "rgba(80, 40, 90, 0.2)",
    tape: true,
    light: true,
    glow: 0.7,
  },
};

export class BoardThemes {
  static readonly GLOWS: Record<BoardGlow, number> = { off: 0, soft: 0.5, normal: 1, strong: 1.8 };
  static readonly DARK_INK = "#1F1B16";
  static readonly LIGHT_INK = "#F3F4F8";

  static of(
    theme: BoardTheme | undefined,
    colors?: BoardColors | null,
    glow?: BoardGlow,
  ): BoardPalette {
    const base = PALETTES[theme ?? "paper"] ?? PALETTES.paper;
    const own = colors ?? {};
    const background = own.background ?? base.background;
    const light = own.background ? BoardThemes.bright(background) : base.light;
    const flipped = light !== base.light;
    const ink = own.ink ?? (flipped ? BoardThemes.readable(background) : base.ink);
    const card =
      own.card ??
      (flipped ? BoardThemes.mix(background, "#FFFFFF", light ? 0.65 : 0.08) : base.card);
    const cardInk =
      own.cardInk ??
      (BoardThemes.bright(card) === BoardThemes.bright(base.card)
        ? base.cardInk
        : BoardThemes.readable(card));
    return {
      ...base,
      background,
      light,
      ink,
      card,
      cardInk,
      muted:
        own.muted ?? (flipped || own.ink ? BoardThemes.mix(ink, background, 0.45) : base.muted),
      accent: own.accent ?? base.accent,
      accent2: own.accent2 ?? base.accent2,
      shadow: flipped ? (light ? "rgba(40, 30, 20, 0.25)" : "rgba(0, 0, 0, 0.5)") : base.shadow,
      tape: light && base.tape,
      glow: base.glow * BoardThemes.GLOWS[glow ?? "normal"],
    };
  }

  static swatches() {
    return BOARD_THEMES.map((key) => {
      const { background, ink, accent, light } = BoardThemes.of(key);
      return {
        key,
        kind: "theme" as const,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        tags: [light ? "light" : "dark"],
        swatch: { background, ink, accent },
      };
    });
  }

  static rgb(hex: string): [number, number, number] {
    const n = Number.parseInt(hex.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  static luminance(hex: string): number {
    const [r, g, b] = BoardThemes.rgb(hex).map((c) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  static bright(hex: string): boolean {
    return BoardThemes.luminance(hex) > 0.32;
  }

  static contrast(a: string, b: string): number {
    const la = BoardThemes.luminance(a);
    const lb = BoardThemes.luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  static readable(hex: string): string {
    return BoardThemes.bright(hex) ? BoardThemes.DARK_INK : BoardThemes.LIGHT_INK;
  }

  static visibleOn(fg: string, bg: string, minRatio = 4.2): string {
    if (BoardThemes.contrast(fg, bg) >= minRatio) return fg;
    const target = BoardThemes.bright(bg) ? BoardThemes.DARK_INK : BoardThemes.LIGHT_INK;
    for (let step = 0.2; step <= 1; step += 0.15) {
      const candidate = BoardThemes.mix(fg, target, step);
      if (BoardThemes.contrast(candidate, bg) >= minRatio) return candidate;
    }
    return target;
  }

  static mix(a: string, b: string, share: number): string {
    const from = BoardThemes.rgb(a);
    const to = BoardThemes.rgb(b);
    return `#${from
      .map((c, i) =>
        Math.round(c + (to[i] - c) * share)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase()}`;
  }
}

/** Named paints a piece can ask for when what it shows is a colour (a "Blue" bar is blue),
 *  the same on every theme. */
export const PAINTS = {
  red: "#D7263D",
  orange: "#F28C28",
  yellow: "#F2C511",
  green: "#2F9E5B",
  blue: "#2E6FD8",
  purple: "#7B4FC9",
  pink: "#E85D9E",
  brown: "#8B5A2B",
  grey: "#8A8F98",
  black: "#1F1B16",
  white: "#F5F5F0",
} as const;
export type Paint = keyof typeof PAINTS;
export const PAINT_NAMES = Object.keys(PAINTS) as [Paint, ...Paint[]];
