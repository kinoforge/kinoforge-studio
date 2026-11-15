import type { PieceOf } from "../spec.ts";
import { BOARD_FONT, BOARD_MONO, type BoardPalette } from "../theme.ts";
import { FitText } from "../timeline.ts";
import { Ease, type PieceProps } from "./ease.ts";

export function TitleView({ piece, w, h, t, palette }: PieceProps<"title">) {
  const kicker = piece.kicker ? Math.round(h * 0.16) : 0;
  const size = FitText.size(piece.text, { w, h: h - kicker * 1.6 }, Math.round(h * 0.42), 2);
  const words = piece.text.split(/\s+/);
  return (
    <div
      style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}
    >
      {piece.kicker ? (
        <div
          style={{
            fontSize: kicker,
            fontWeight: 800,
            letterSpacing: kicker * 0.12,
            textTransform: "uppercase",
            color: palette.accent,
            opacity: Ease.out(t, 0.3),
            marginBottom: kicker * 0.4,
          }}
        >
          {piece.kicker}
        </div>
      ) : null}
      <div
        style={{
          fontSize: size,
          fontWeight: 900,
          lineHeight: 1.08,
          color: palette.cardInk,
          ...FitText.clamp(2),
        }}
      >
        {words.map((word, i) => {
          const p = Ease.out(t, 0.35, 0.08 * i);
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: p,
                transform: `translateY(${(1 - p) * size * 0.4}px)`,
                marginRight: size * 0.25,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function NoteView({ piece, w, h, t, palette }: PieceProps<"note">) {
  const size = FitText.size(piece.text, { w, h: h * 0.9 }, Math.round(h * 0.3), 4);
  const sweep = Ease.out(t, 0.7, 0.25);
  return (
    <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
      <div
        style={{
          fontSize: size,
          fontWeight: 700,
          lineHeight: 1.22,
          color: palette.cardInk,
          ...FitText.clamp(4),
        }}
      >
        <span
          style={{
            backgroundImage: `linear-gradient(${palette.accent}55, ${palette.accent}55)`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${sweep * 100}% 38%`,
            backgroundPosition: "0 88%",
            boxDecorationBreak: "clone",
            WebkitBoxDecorationBreak: "clone",
          }}
        >
          {piece.text}
        </span>
      </div>
    </div>
  );
}

export function QuoteView({ piece, w, h, t, palette }: PieceProps<"quote">) {
  const mark = Math.round(Math.min(h * 0.4, w * 0.12));
  const size = FitText.size(piece.text, { w: w * 0.82, h: h * 0.7 }, Math.round(h * 0.24), 3);
  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        paddingLeft: mark * 0.9,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -mark * 0.1,
          fontSize: mark,
          fontWeight: 900,
          color: palette.accent,
          opacity: Ease.out(t, 0.4),
          lineHeight: 1,
        }}
      >
        “
      </div>
      <div
        style={{
          fontSize: size,
          fontStyle: "italic",
          fontWeight: 600,
          lineHeight: 1.25,
          color: palette.cardInk,
          opacity: Ease.out(t, 0.5, 0.1),
          ...FitText.clamp(3),
        }}
      >
        {piece.text}
      </div>
      {piece.by ? (
        <div
          style={{
            marginTop: size * 0.5,
            fontSize: size * 0.62,
            fontWeight: 700,
            color: palette.muted,
            opacity: Ease.out(t, 0.4, 0.5),
          }}
        >
          {piece.by}
        </div>
      ) : null}
    </div>
  );
}

const OPERATOR = /[=+\-×*/÷<>≈^()∝≤≥≠]/;

export function FormulaView({ piece, w, h, t, span, palette }: PieceProps<"formula">) {
  const size = FitText.size(piece.text, { w, h: h * 0.8 }, Math.round(h * 0.42), 2, "mono");
  const chars = Array.from(piece.text);
  const shown = Math.ceil(chars.length * Ease.clamp(t / Math.min(1.4, span * 0.6)));
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        fontFamily: BOARD_MONO,
        fontSize: size,
        fontWeight: 700,
        color: palette.cardInk,
      }}
    >
      {/* Every character is laid out from the start, so the line never reflows as it types. */}
      <div
        style={{
          whiteSpace: "pre-wrap",
          textAlign: "center",
          lineHeight: 1.2,
          ...FitText.clamp(2),
        }}
      >
        {chars.map((char, i) => (
          <span
            key={i}
            style={{
              color: OPERATOR.test(char) ? palette.accent : undefined,
              opacity: i < shown ? 1 : 0,
            }}
          >
            {char}
          </span>
        ))}
      </div>
    </div>
  );
}

const TONES = { good: "good", bad: "bad", warn: "warn" } as const;

export class StampBadge {
  static readonly HOLD = 1.8;
  static readonly FADE = 0.35;
  static readonly SHARE = 0.036;
  static readonly REACH = 0.62;

  static shows(t: number): boolean {
    return t >= 0 && t < StampBadge.HOLD + StampBadge.FADE;
  }

  static size(text: string, frame: number, room: number): number {
    const word = text.toUpperCase();
    const per = FitText.width(word, 1) + Array.from(word).length * 0.06 + 1.2;
    return Math.max(
      FitText.SMALLEST,
      Math.min(frame * StampBadge.SHARE, (room * StampBadge.REACH) / per),
    );
  }
}

export function StampView({
  piece,
  size,
  t,
  palette,
}: {
  piece: PieceOf<"stamp">;
  size: number;
  t: number;
  palette: BoardPalette;
}) {
  const color = palette[TONES[piece.tone]];
  const pop = Ease.pop(t, 0.35);
  const fade = Ease.out(t - StampBadge.HOLD, StampBadge.FADE);
  return (
    <div
      style={{
        fontFamily: BOARD_FONT,
        fontSize: size,
        fontWeight: 900,
        letterSpacing: size * 0.06,
        textTransform: "uppercase",
        color,
        background: palette.card,
        border: `${Math.max(3, size * 0.12)}px solid ${color}`,
        borderRadius: size * 0.3,
        padding: `${size * 0.16}px ${size * 0.42}px`,
        boxShadow: `0 ${size * 0.15}px ${size * 0.5}px ${palette.shadow}`,
        transform: `rotate(-6deg) scale(${Math.max(0, pop)})`,
        opacity: 1 - fade,
        whiteSpace: "nowrap",
      }}
    >
      {piece.text}
    </div>
  );
}
