import { BOARD_MONO } from "../theme.ts";
import { FitText } from "../timeline.ts";
import { Ease, type PieceProps } from "./ease.ts";

class Numbers {
  static format(value: number, decimals: number): string {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
}

export function CounterView({ piece, w, h, t, span, palette }: PieceProps<"counter">) {
  const decimals = piece.decimals ?? (Number.isInteger(piece.to) ? 0 : 1);
  const from = piece.from ?? 0;
  const p = Ease.out(t, Math.min(1.8, Math.max(0.8, span * 0.6)), 0.1);
  const value = Numbers.format(from + (piece.to - from) * p, decimals);
  const final = `${piece.prefix ?? ""}${Numbers.format(piece.to, decimals)}${piece.suffix ?? ""}`;
  const big = FitText.size(final, { w, h: h * 0.62 }, Math.round(h * 0.56), 1);
  const small = FitText.size(piece.label, { w, h: h * 0.3 }, Math.round(h * 0.16), 2);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
      }}
    >
      <div
        style={{
          fontSize: big,
          fontWeight: 900,
          lineHeight: 1,
          color: palette.accent,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {piece.prefix}
        {value}
        {piece.suffix}
      </div>
      <div
        style={{
          marginTop: small * 0.4,
          fontSize: small,
          fontWeight: 700,
          color: palette.cardInk,
          textAlign: "center",
          opacity: Ease.out(t, 0.4, 0.3),
        }}
      >
        {piece.label}
      </div>
    </div>
  );
}

export function BarsView({ piece, w, h, t, span, palette }: PieceProps<"bars">) {
  const count = piece.items.length;
  const top = Math.max(...piece.items.map((item) => item.value), 1);
  const slot = w / count;
  const label = Math.round(
    Math.min(h * 0.09, (slot * 1.6) / Math.max(5, ...piece.items.map((i) => i.label.length))),
  );
  const plot = h - label * 4.2;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", height: "100%" }}>
      {piece.items.map((item, i) => {
        const grow = Ease.out(t, 0.7, Ease.stagger(i, count, span) * 0.6);
        const height = Math.max(4, (item.value / top) * plot * grow);
        const color = item.value === top ? palette.accent : palette.accent2;
        return (
          <div
            key={i}
            style={{
              width: slot,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              height: "100%",
            }}
          >
            <div
              style={{
                fontSize: label * 1.1,
                fontWeight: 900,
                color: palette.cardInk,
                opacity: grow,
                marginBottom: label * 0.3,
              }}
            >
              {Numbers.format(item.value * grow, Number.isInteger(item.value) ? 0 : 1)}
              {piece.unit ? ` ${piece.unit}` : ""}
            </div>
            <div
              style={{
                width: slot * 0.62,
                height,
                background: color,
                borderRadius: `${slot * 0.08}px ${slot * 0.08}px 0 0`,
              }}
            />
            <div style={{ height: 3, width: slot, background: palette.muted }} />
            <div
              style={{
                marginTop: label * 0.4,
                fontSize: label,
                fontWeight: 700,
                color: palette.muted,
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

export function ProgressView({ piece, w, h, t, span, palette }: PieceProps<"progress">) {
  const p = Ease.out(t, Math.min(1.6, Math.max(0.7, span * 0.6)), 0.15);
  const size = FitText.size(piece.label, { w: w * 0.7, h: h * 0.3 }, Math.round(h * 0.22), 1);
  const track = h * 0.26;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        height: "100%",
        gap: h * 0.08,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: size, fontWeight: 800, color: palette.cardInk }}>
          {piece.label}
        </span>
        <span style={{ fontSize: size * 1.4, fontWeight: 900, color: palette.accent }}>
          {Math.round(piece.value * p)}%
        </span>
      </div>
      <div
        style={{
          height: track,
          borderRadius: track / 2,
          background: `${palette.muted}33`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${piece.value * p}%`,
            height: "100%",
            borderRadius: track / 2,
            background: palette.accent,
          }}
        />
      </div>
    </div>
  );
}

export function CompareView({ piece, w, h, t, span, palette }: PieceProps<"compare">) {
  const half = w * 0.43;
  const inner = half * 0.82;
  const longest = [...piece.left.items, ...piece.right.items].reduce(
    (a, b) => (b.length > a.length ? b : a),
    "",
  );
  const rows = Math.max(piece.left.items.length, piece.right.items.length);
  const size = FitText.size(longest, { w: inner, h: (h * 0.6) / rows }, Math.round(h * 0.11), 2);
  const titles =
    piece.left.title.length > piece.right.title.length ? piece.left.title : piece.right.title;
  const head = Math.min(
    Math.round(size * 1.4),
    FitText.size(titles, { w: inner, h: h * 0.18 }, Math.round(h * 0.15), 1),
  );
  const badge = Math.min(head * 1.6, (w - half * 2) * 1.1);
  const verdict = Ease.pop(t, 0.4, Math.max(1, span * 0.7));
  const column = (which: "left" | "right", delay: number) => {
    const sideData = piece[which];
    const p = Ease.out(t, 0.4, delay);
    const won = piece.winner === which;
    return (
      <div
        style={{
          width: half,
          height: "100%",
          boxSizing: "border-box",
          borderRadius: half * 0.08,
          padding: half * 0.09,
          background: `${which === "left" ? palette.accent : palette.accent2}1A`,
          border: `4px solid ${won && verdict > 0.5 ? palette.good : "transparent"}`,
          opacity: p,
          transform: `translateY(${(1 - p) * 30}px)`,
          position: "relative",
        }}
      >
        <div
          style={{
            fontSize: head,
            fontWeight: 900,
            color: which === "left" ? palette.accent : palette.accent2,
            marginBottom: head * 0.4,
          }}
        >
          {sideData.title}
        </div>
        {sideData.items.map((item, i) => (
          <div
            key={i}
            style={{
              fontSize: size,
              fontWeight: 700,
              color: palette.cardInk,
              lineHeight: 1.2,
              marginBottom: size * 0.35,
              opacity: Ease.out(t, 0.3, delay + 0.25 + i * 0.2),
            }}
          >
            {item}
          </div>
        ))}
        {won ? (
          <div
            style={{
              position: "absolute",
              top: -head * 0.6,
              right: -head * 0.4,
              width: head * 1.4,
              height: head * 1.4,
              borderRadius: "50%",
              background: palette.good,
              color: "#fff",
              fontSize: head * 0.9,
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${verdict})`,
            }}
          >
            ✓
          </div>
        ) : null}
      </div>
    );
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        justifyContent: "space-between",
        height: "100%",
        position: "relative",
      }}
    >
      {column("left", 0.1)}
      <div
        style={{
          position: "absolute",
          left: w / 2 - badge / 2,
          top: h / 2 - badge / 2,
          width: badge,
          height: badge,
          borderRadius: "50%",
          background: palette.cardInk,
          color: palette.card,
          fontSize: badge * 0.38,
          fontWeight: 900,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
          transform: `scale(${Ease.pop(t, 0.35, 0.3)})`,
        }}
      >
        VS
      </div>
      {column("right", 0.45)}
    </div>
  );
}

export function TerminalView({ piece, w, h, t, span, palette }: PieceProps<"terminal">) {
  const bar = h * 0.13;
  const rows = Math.max(3, piece.lines.length);
  const longest = piece.lines.reduce((a, b) => (b.length > a.length ? b : a), "");
  const size = FitText.size(
    `$ ${longest}`,
    { w: w * 0.86, h: ((h - bar) / rows) * 0.8 },
    Math.round(((h - bar) / rows) * 0.5),
    1,
    FitText.MONO,
  );
  const total = piece.lines.reduce((sum, line) => sum + line.length, 0);
  const rate = Math.max(28, total / Math.max(0.8, span * 0.75));
  let budget = Math.max(0, t - 0.2) * rate;
  return (
    <div
      style={{
        height: "100%",
        borderRadius: w * 0.025,
        overflow: "hidden",
        background: "#14161C",
        boxShadow: "inset 0 0 0 2px #2A2E38",
      }}
    >
      <div
        style={{
          height: bar,
          background: "#23262F",
          display: "flex",
          alignItems: "center",
          gap: bar * 0.22,
          paddingLeft: bar * 0.4,
        }}
      >
        {["#FF5F57", "#FEBC2E", "#28C840"].map((color) => (
          <div
            key={color}
            style={{
              width: bar * 0.32,
              height: bar * 0.32,
              borderRadius: "50%",
              background: color,
            }}
          />
        ))}
        <div
          style={{
            marginLeft: bar * 0.3,
            fontFamily: BOARD_MONO,
            fontSize: bar * 0.38,
            color: "#9AA0AE",
          }}
        >
          {piece.title ?? "terminal"}
        </div>
      </div>
      <div
        style={{
          padding: `${size * 0.6}px ${size * 0.8}px`,
          fontFamily: BOARD_MONO,
          fontSize: size,
          lineHeight: 1.45,
          color: "#E6E9EF",
        }}
      >
        {piece.lines.map((line, i) => {
          const shown = Math.max(0, Math.min(line.length, Math.floor(budget)));
          budget -= line.length;
          const typing = shown < line.length && shown > 0;
          if (shown === 0 && i > 0) return null;
          return (
            <div key={i} style={{ whiteSpace: "pre" }}>
              <span style={{ color: palette.good }}>$ </span>
              {line.slice(0, shown)}
              {typing || (i === piece.lines.length - 1 && shown === line.length) ? (
                <span style={{ opacity: Math.floor(t * 2.2) % 2 ? 0 : 1, color: "#E6E9EF" }}>
                  ▍
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
