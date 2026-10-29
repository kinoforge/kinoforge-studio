import { BOARD_FONT, BOARD_MONO } from "../theme.ts";
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
      <div style={{ fontSize: size, fontWeight: 900, lineHeight: 1.08, color: palette.cardInk }}>
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
      <div style={{ fontSize: size, fontWeight: 700, lineHeight: 1.22, color: palette.cardInk }}>
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
  const size = FitText.size(piece.text, { w, h: h * 0.8 }, Math.round(h * 0.42), 2, FitText.MONO);
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
      <div style={{ whiteSpace: "pre-wrap", textAlign: "center", lineHeight: 1.2 }}>
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

/** Slammed over the board, not stacked: a verdict on what is showing. */
export function StampView({ piece, w, t, palette }: Omit<PieceProps<"stamp">, "h" | "span">) {
  const color = palette[TONES[piece.tone]];
  const size = Math.round(Math.min(w * 0.13, (w * 1.2) / Math.max(4, piece.text.length)));
  const slam = Ease.out(t, 0.22);
  const shake = t < 0.4 ? Math.sin(t * 90) * (0.4 - t) * 6 : 0;
  return (
    <div
      style={{
        fontFamily: BOARD_FONT,
        fontSize: size,
        fontWeight: 900,
        letterSpacing: size * 0.08,
        textTransform: "uppercase",
        color,
        border: `${Math.max(4, size * 0.09)}px solid ${color}`,
        borderRadius: size * 0.18,
        padding: `${size * 0.12}px ${size * 0.35}px`,
        transform: `rotate(-12deg) scale(${2.2 - 1.2 * slam}) translateX(${shake}px)`,
        opacity: Math.min(1, slam * 1.4) * 0.92,
        mixBlendMode: palette.light ? "multiply" : "normal",
        whiteSpace: "nowrap",
      }}
    >
      {piece.text}
    </div>
  );
}
