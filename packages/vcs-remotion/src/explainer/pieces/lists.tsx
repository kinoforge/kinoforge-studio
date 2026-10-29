import { BOARD_ICONS } from "../icons.ts";
import { FitText } from "../timeline.ts";
import type { BoardPalette } from "../theme.ts";
import { Ease, type PieceProps } from "./ease.ts";

function Marker({
  style,
  index,
  size,
  p,
  palette,
}: {
  style: "check" | "bullet" | "number" | "cross";
  index: number;
  size: number;
  p: number;
  palette: BoardPalette;
}) {
  const color = style === "check" ? palette.good : style === "cross" ? palette.bad : palette.accent;
  const draw = { strokeDasharray: 40, strokeDashoffset: 40 * (1 - Ease.clamp(p * 1.4 - 0.3)) };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ flexShrink: 0, transform: `scale(${p})` }}
    >
      {style === "bullet" ? (
        <circle cx={12} cy={12} r={6} fill={color} />
      ) : (
        <circle cx={12} cy={12} r={11} fill={color} />
      )}
      {style === "check" ? (
        <path
          d="M6.5 12.5 L10.5 16.5 L17.5 8.5"
          stroke="#fff"
          strokeWidth={2.8}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...draw}
        />
      ) : null}
      {style === "cross" ? (
        <path
          d="M8 8 L16 16 M16 8 L8 16"
          stroke="#fff"
          strokeWidth={2.8}
          strokeLinecap="round"
          {...draw}
        />
      ) : null}
      {style === "number" ? (
        <text x={12} y={16.5} textAnchor="middle" fontSize={13} fontWeight={800} fill="#fff">
          {index + 1}
        </text>
      ) : null}
    </svg>
  );
}

export function ListView({ piece, w, h, t, span, palette }: PieceProps<"list">) {
  const rows = piece.items.length;
  const longest = piece.items.reduce((a, b) => (b.length > a.length ? b : a), "");
  const size = FitText.size(
    longest,
    { w: w * 0.84, h: (h / rows) * 0.8 },
    Math.round((h / rows) * 0.5),
    1,
  );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-evenly",
        height: "100%",
      }}
    >
      {piece.items.map((item, i) => {
        const p = Ease.pop(t, 0.35, Ease.stagger(i, rows, span));
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: size * 0.5,
              opacity: Ease.clamp(p),
              transform: `translateX(${(1 - Ease.clamp(p)) * -40}px)`,
            }}
          >
            <Marker style={piece.style} index={i} size={size * 1.15} p={p} palette={palette} />
            <span
              style={{
                fontSize: size,
                fontWeight: 700,
                color: palette.cardInk,
                textDecoration: piece.style === "cross" ? "line-through" : undefined,
                textDecorationColor: palette.bad,
              }}
            >
              {item}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function StepsView({ piece, w, h, t, span, palette }: PieceProps<"steps">) {
  const count = piece.items.length;
  const arrow = w * 0.06;
  const cell = (w - arrow * (count - 1)) / count;
  const longest = piece.items.reduce((a, b) => (b.length > a.length ? b : a), "");
  const size = FitText.size(longest, { w: cell * 0.82, h: h * 0.5 }, Math.round(h * 0.2), 3);
  return (
    <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
      {piece.items.map((item, i) => {
        const p = Ease.pop(t, 0.4, Ease.stagger(i, count, span));
        return (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 ? (
              <svg
                width={arrow}
                height={arrow}
                viewBox="0 0 24 24"
                style={{ opacity: Ease.clamp(p) }}
              >
                <path
                  d="M3 12 H19 M13 6 L19 12 L13 18"
                  stroke={palette.muted}
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
            <div
              style={{
                width: cell,
                height: h * 0.78,
                borderRadius: cell * 0.12,
                background: i === count - 1 ? palette.accent : `${palette.accent2}22`,
                border: `3px solid ${i === count - 1 ? palette.accent : palette.accent2}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${p})`,
                padding: cell * 0.06,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: size * 0.8,
                  fontWeight: 900,
                  color: i === count - 1 ? "#fff" : palette.accent2,
                }}
              >
                {i + 1}
              </div>
              <div
                style={{
                  fontSize: size,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  color: i === count - 1 ? "#fff" : palette.cardInk,
                }}
              >
                {item}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TimelineView({ piece, w, h, t, span, palette }: PieceProps<"timeline">) {
  const rows = piece.items.length;
  const row = h / rows;
  const longest = piece.items.reduce((a, b) => (b.text.length > a.length ? b.text : a), "");
  const when = piece.items.reduce((a, b) => (b.when.length > a.length ? b.when : a), "");
  const whenW = w * 0.26;
  const size = FitText.size(longest, { w: w * 0.6, h: row * 0.8 }, Math.round(row * 0.42), 2);
  const whenSize = Math.min(
    size,
    FitText.size(when, { w: whenW, h: row * 0.6 }, Math.round(row * 0.42), 1),
  );
  const line = Ease.out(t, Math.max(0.6, span * 0.7), 0.1);
  return (
    <div style={{ position: "relative", height: "100%" }}>
      <div
        style={{
          position: "absolute",
          left: whenW + w * 0.04 - 2,
          top: row * 0.5,
          width: 4,
          height: (h - row) * line,
          background: palette.muted,
          borderRadius: 2,
        }}
      />
      {piece.items.map((item, i) => {
        const p = Ease.pop(t, 0.35, Ease.stagger(i, rows, span));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: i * row,
              height: row,
              left: 0,
              right: 0,
              display: "flex",
              alignItems: "center",
              opacity: Ease.clamp(p),
            }}
          >
            <div
              style={{
                width: whenW,
                textAlign: "right",
                whiteSpace: "nowrap",
                fontSize: whenSize,
                fontWeight: 900,
                color: palette.accent,
              }}
            >
              {item.when}
            </div>
            <div style={{ width: w * 0.08, display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  width: size * 0.6,
                  height: size * 0.6,
                  borderRadius: "50%",
                  background: palette.accent,
                  transform: `scale(${p})`,
                  boxShadow: `0 0 0 5px ${palette.card}`,
                }}
              />
            </div>
            <div
              style={{
                flex: 1,
                fontSize: size,
                fontWeight: 700,
                lineHeight: 1.15,
                color: palette.cardInk,
              }}
            >
              {item.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function IconsView({ piece, w, h, t, span, palette }: PieceProps<"icons">) {
  const count = piece.items.length;
  const cell = w / count;
  const disc = Math.min(cell * 0.62, h * 0.6);
  const size = Math.round(
    Math.min(disc * 0.3, (cell * 1.5) / Math.max(6, ...piece.items.map((i) => i.label.length))),
  );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        height: "100%",
      }}
    >
      {piece.items.map((item, i) => {
        const Icon = BOARD_ICONS[item.icon].icon;
        const p = Ease.pop(t, 0.4, Ease.stagger(i, count, span));
        const color = i % 2 ? palette.accent2 : palette.accent;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: cell,
              opacity: Ease.clamp(p),
            }}
          >
            <div
              style={{
                width: disc,
                height: disc,
                borderRadius: "50%",
                background: `${color}26`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${p}) rotate(${(1 - Ease.clamp(p)) * -20}deg)`,
              }}
            >
              <Icon size={disc * 0.56} color={color} strokeWidth={2.2} />
            </div>
            <div
              style={{
                marginTop: disc * 0.12,
                fontSize: size,
                fontWeight: 800,
                color: palette.cardInk,
                textAlign: "center",
              }}
            >
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
