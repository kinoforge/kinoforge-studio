import { BOARD_FONT } from "../theme.ts";
import { FitText } from "../timeline.ts";
import { Ease, type PieceProps } from "./ease.ts";

const SCREEN = {
  glass: "#0F1116",
  bar: "#1C1F27",
  them: "#2A2E38",
  ink: "#F2F3F6",
  muted: "#9AA0AE",
};

function Dots({ size, t }: { size: number; t: number }) {
  return (
    <div style={{ display: "flex", gap: size * 0.3, padding: `${size * 0.5}px ${size * 0.7}px` }}>
      {[0, 1, 2].map((k) => (
        <div
          key={k}
          style={{
            width: size * 0.42,
            height: size * 0.42,
            borderRadius: "50%",
            background: SCREEN.muted,
            opacity: 0.4 + 0.6 * Math.abs(Math.sin(t * 6 - k * 0.8)),
          }}
        />
      ))}
    </div>
  );
}

/** A messaging app: the other side typing, then each bubble popping in, mine on the right. */
export function ChatView({ piece, w, h, t, span, palette }: PieceProps<"chat">) {
  const count = piece.messages.length;
  const bar = piece.title ? h * 0.13 : 0;
  // Bubbles wrap, so the text is sized from the card, not from the longest message.
  const size = Math.round(Math.min((h - bar) / (count * 3 + 1.5), w / 22));
  const step = Math.min(0.9, Math.max(0.35, (span * 0.8) / count));
  return (
    <div
      style={{
        height: "100%",
        borderRadius: Math.min(w, h) * 0.06,
        overflow: "hidden",
        background: SCREEN.glass,
        display: "flex",
        flexDirection: "column",
        fontFamily: BOARD_FONT,
      }}
    >
      {piece.title ? (
        <div
          style={{
            height: bar,
            background: SCREEN.bar,
            display: "flex",
            alignItems: "center",
            gap: bar * 0.25,
            padding: `0 ${bar * 0.35}px`,
            color: SCREEN.ink,
            fontWeight: 800,
            fontSize: bar * 0.4,
          }}
        >
          <div
            style={{
              width: bar * 0.6,
              height: bar * 0.6,
              borderRadius: "50%",
              background: palette.accent2,
            }}
          />
          {piece.title}
        </div>
      ) : null}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: size * 0.5,
          padding: size * 0.7,
        }}
      >
        {piece.messages.map((message, i) => {
          const mine = message.from === "me";
          const at = 0.2 + i * step;
          const typing = !mine && t >= at - 0.45 && t < at;
          const pop = Ease.pop(t - at, 0.35);
          if (t < at && !typing) return null;
          return (
            <div
              key={i}
              style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}
            >
              <div
                style={{
                  maxWidth: "76%",
                  borderRadius: size * 0.9,
                  borderBottomRightRadius: mine ? size * 0.2 : size * 0.9,
                  borderBottomLeftRadius: mine ? size * 0.9 : size * 0.2,
                  background: mine ? palette.accent : SCREEN.them,
                  color: mine ? "#101216" : SCREEN.ink,
                  fontSize: size,
                  fontWeight: 600,
                  lineHeight: 1.25,
                  padding: typing ? 0 : `${size * 0.45}px ${size * 0.7}px`,
                  transform: `scale(${typing ? 1 : Math.max(0, pop)})`,
                  transformOrigin: mine ? "right bottom" : "left bottom",
                }}
              >
                {typing ? <Dots size={size} t={t} /> : message.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A browser window: the address typing in, then the page's heading, lines and button. */
export function BrowserView({ piece, w, h, t, span, palette }: PieceProps<"browser">) {
  const bar = Math.min(h * 0.16, w * 0.08);
  const lines = piece.lines ?? [];
  const typed = Math.ceil(piece.url.length * Ease.clamp(t / 0.6));
  const body = h - bar;
  const heading = FitText.size(
    piece.heading,
    { w: w * 0.86, h: body * 0.34 },
    Math.round(body * 0.17),
    2,
  );
  const text = Math.round(Math.min(body * 0.085, heading * 0.55));
  const step = Math.min(0.6, Math.max(0.25, (span * 0.6) / (lines.length + 2)));
  const show = (k: number) => Ease.out(t, 0.35, 0.55 + k * step);
  return (
    <div
      style={{
        height: "100%",
        borderRadius: bar * 0.3,
        overflow: "hidden",
        background: "#FFFFFF",
        boxShadow: `inset 0 0 0 2px ${palette.muted}40`,
        fontFamily: BOARD_FONT,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: bar,
          flexShrink: 0,
          background: "#ECEEF2",
          display: "flex",
          alignItems: "center",
          gap: bar * 0.2,
          padding: `0 ${bar * 0.3}px`,
        }}
      >
        {["#FF5F57", "#FEBC2E", "#28C840"].map((color) => (
          <div
            key={color}
            style={{
              width: bar * 0.24,
              height: bar * 0.24,
              borderRadius: "50%",
              background: color,
            }}
          />
        ))}
        <div
          style={{
            flex: 1,
            marginLeft: bar * 0.2,
            height: bar * 0.58,
            borderRadius: bar * 0.3,
            background: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            padding: `0 ${bar * 0.3}px`,
            fontSize: bar * 0.3,
            color: "#3B3F48",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          <span style={{ color: palette.good, marginRight: bar * 0.15 }}>●</span>
          {piece.url.slice(0, typed)}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          padding: `${body * 0.08}px ${w * 0.07}px`,
          display: "flex",
          flexDirection: "column",
          gap: body * 0.05,
        }}
      >
        <div
          style={{
            fontSize: heading,
            fontWeight: 900,
            color: "#14161B",
            lineHeight: 1.15,
            opacity: show(0),
          }}
        >
          {piece.heading}
        </div>
        {lines.map((line, k) => (
          <div
            key={k}
            style={{ fontSize: text, fontWeight: 600, color: "#5A606C", opacity: show(k + 1) }}
          >
            {line}
          </div>
        ))}
        {piece.button ? (
          <div
            style={{
              alignSelf: "flex-start",
              marginTop: body * 0.03,
              padding: `${text * 0.5}px ${text * 1.2}px`,
              borderRadius: text * 0.6,
              background: palette.accent,
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: text,
              transform: `scale(${Math.max(0, Ease.pop(t, 0.4, 0.55 + (lines.length + 1) * step))})`,
              transformOrigin: "left center",
            }}
          >
            {piece.button}
          </div>
        ) : null}
      </div>
    </div>
  );
}
