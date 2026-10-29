import { BOARD_FONT } from "../theme.ts";
import { Numbers } from "./data.tsx";
import { Ease, type PieceProps } from "./ease.ts";

/** A line that draws itself left to right, its points lit as it reaches them. */
export function LineView({ piece, w, h, t, span, palette }: PieceProps<"line">) {
  const values = piece.points.map((point) => point.value);
  const top = Math.max(...values);
  const low = Math.min(...values);
  const floor = low < 0 ? low : low > top * 0.5 ? low - (top - low) * 0.35 : 0;
  const ceil = top + (top - floor) * 0.12 || 1;
  const label = Math.round(Math.min(h * 0.085, w / (piece.points.length * 4.2)));
  const left = label * 1.2;
  const right = label * 4.5;
  const plotTop = label * 1.8;
  const plotBottom = h - label * 2.4;
  const x = (i: number) => left + ((w - left - right) * i) / (piece.points.length - 1);
  const y = (v: number) => plotBottom - ((v - floor) / (ceil - floor)) * (plotBottom - plotTop);
  const draw = Ease.out(t, Math.min(1.6, Math.max(0.7, span * 0.6)), 0.15);
  const reach = draw * (piece.points.length - 1);
  const shown = piece.points.flatMap((point, i) => {
    if (i <= reach) return [{ x: x(i), y: y(point.value) }];
    if (i - 1 < reach) {
      const k = reach - (i - 1);
      const a = piece.points[i - 1].value;
      return [{ x: x(i - 1) + (x(i) - x(i - 1)) * k, y: y(a + (point.value - a) * k) }];
    }
    return [];
  });
  const line = shown.map((p) => `${p.x},${p.y}`).join(" ");
  const area = shown.length
    ? `${shown[0].x},${plotBottom} ${line} ${shown.at(-1)?.x},${plotBottom}`
    : "";
  const every = Math.ceil(piece.points.length / Math.max(2, Math.floor(w / (label * 6))));
  // Every few labels, and always the last: it takes the place of one too close before it.
  const final = piece.points.length - 1;
  const marked = piece.points.map((_, i) => i).filter((i) => i % every === 0);
  if (marked.at(-1) !== final) {
    if (final - (marked.at(-1) as number) < every * 0.75) marked.pop();
    marked.push(final);
  }
  const end = shown.at(-1);
  const last = piece.points[Math.min(piece.points.length - 1, Math.floor(reach))];
  return (
    <svg width={w} height={h} style={{ overflow: "visible", fontFamily: BOARD_FONT }}>
      <defs>
        <linearGradient id="line-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={palette.accent} stopOpacity={0.35} />
          <stop offset="1" stopColor={palette.accent} stopOpacity={0} />
        </linearGradient>
      </defs>
      <line
        x1={left}
        x2={w - right}
        y1={plotBottom}
        y2={plotBottom}
        stroke={palette.muted}
        strokeWidth={3}
      />
      {area ? <polygon points={area} fill="url(#line-fill)" /> : null}
      <polyline
        points={line}
        fill="none"
        stroke={palette.accent}
        strokeWidth={Math.max(4, label * 0.32)}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {piece.points.map((point, i) =>
        i <= reach ? (
          <circle
            key={i}
            cx={x(i)}
            cy={y(point.value)}
            r={label * 0.32 * Ease.pop(reach - i, 0.4)}
            fill={palette.card}
            stroke={palette.accent}
            strokeWidth={Math.max(3, label * 0.2)}
          />
        ) : null,
      )}
      {piece.points.map((point, i) =>
        marked.includes(i) ? (
          <text
            key={i}
            x={x(i)}
            y={h - label * 0.6}
            textAnchor="middle"
            fontSize={label}
            fontWeight={700}
            fill={palette.muted}
          >
            {point.label}
          </text>
        ) : null,
      )}
      {end ? (
        <text
          x={end.x + label * 0.6}
          y={end.y + label * 0.35}
          fontSize={label * 1.15}
          fontWeight={900}
          fill={palette.cardInk}
        >
          {Numbers.format(last.value, Number.isInteger(last.value) ? 0 : 1)}
          {piece.unit ? ` ${piece.unit}` : ""}
        </text>
      ) : null}
    </svg>
  );
}

const SLICES = ["accent", "accent2", "good", "warn", "bad"] as const;

/** A donut whose slices sweep in one after another, with a legend of shares beside it. */
export function PieView({ piece, w, h, t, span, palette }: PieceProps<"pie">) {
  const total = piece.items.reduce((sum, item) => sum + item.value, 0);
  const side = w > h * 1.3;
  const size = side ? Math.min(h, w * 0.45) : Math.min(w, h * 0.62);
  const r = size / 2;
  const ring = r * 0.36;
  const sweep = Ease.out(t, Math.min(1.4, Math.max(0.6, span * 0.6)), 0.1);
  let angle = -Math.PI / 2;
  const rows = piece.items.length;
  const label = Math.round(
    Math.min((side ? h : h - size) / (rows * 1.7), (side ? w - size : w) / 14, h * 0.1),
  );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: side ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: label,
        height: "100%",
      }}
    >
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {piece.items.map((item, i) => {
          const share = (item.value / total) * Math.PI * 2 * sweep;
          const from = angle;
          angle += share;
          const mid = r - ring / 2;
          const a = { x: r + mid * Math.cos(from), y: r + mid * Math.sin(from) };
          const b = { x: r + mid * Math.cos(angle), y: r + mid * Math.sin(angle) };
          if (share <= 0.001) return null;
          return (
            <path
              key={i}
              d={`M ${a.x} ${a.y} A ${mid} ${mid} 0 ${share > Math.PI ? 1 : 0} 1 ${b.x} ${b.y}`}
              fill="none"
              stroke={palette[SLICES[i % SLICES.length]]}
              strokeWidth={ring}
            />
          );
        })}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: label * 0.45 }}>
        {piece.items.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: label * 0.5,
              fontSize: label,
              fontWeight: 700,
              color: palette.cardInk,
              opacity: Ease.out(t, 0.4, 0.2 + i * 0.15),
              whiteSpace: "nowrap",
            }}
          >
            <div
              style={{
                width: label * 0.8,
                height: label * 0.8,
                borderRadius: label * 0.2,
                background: palette[SLICES[i % SLICES.length]],
              }}
            />
            <span style={{ fontWeight: 900 }}>{Math.round((item.value / total) * 100)}%</span>
            <span style={{ color: palette.muted }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A number line with ticks, the marks dropping onto it one at a time. */
export function NumberLineView({ piece, w, h, t, span, palette }: PieceProps<"numberline">) {
  const lo = Math.min(piece.from, piece.to);
  const hi = Math.max(piece.from, piece.to) === lo ? lo + 1 : Math.max(piece.from, piece.to);
  const label = Math.round(Math.min(h * 0.16, w / 22));
  const pad = label * 1.6;
  const y = h * 0.58;
  const x = (v: number) => pad + ((v - lo) / (hi - lo)) * (w - pad * 2);
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const range = hi - lo;
  const step = steps.find((s) => range / s <= 10) ?? range / 10;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(v);
  const grow = Ease.out(t, 0.6);
  return (
    <svg width={w} height={h} style={{ overflow: "visible", fontFamily: BOARD_FONT }}>
      <line
        x1={pad}
        x2={pad + (w - pad * 2) * grow}
        y1={y}
        y2={y}
        stroke={palette.cardInk}
        strokeWidth={Math.max(3, label * 0.18)}
        strokeLinecap="round"
      />
      {ticks.map((v) => (
        <g key={v} opacity={grow}>
          <line
            x1={x(v)}
            x2={x(v)}
            y1={y - label * 0.4}
            y2={y + label * 0.4}
            stroke={palette.cardInk}
            strokeWidth={2}
          />
          <text
            x={x(v)}
            y={y + label * 1.6}
            textAnchor="middle"
            fontSize={label * 0.8}
            fontWeight={700}
            fill={palette.muted}
          >
            {Numbers.format(v, Number.isInteger(v) ? 0 : 1)}
          </text>
        </g>
      ))}
      {piece.marks.map((mark, i) => {
        const drop = Ease.pop(t, 0.45, Ease.stagger(i, piece.marks.length, span) * 0.7 + 0.3);
        if (drop <= 0) return null;
        const mx = x(Math.min(hi, Math.max(lo, mark.at)));
        const color = i ? palette.accent2 : palette.accent;
        return (
          <g key={i} transform={`translate(${mx} ${y - label * (1 - Math.min(1, drop)) * 2})`}>
            <circle r={label * 0.42} fill={color} stroke={palette.card} strokeWidth={3} />
            {mark.label ? (
              <text
                y={-label * 0.9}
                textAnchor="middle"
                fontSize={label}
                fontWeight={900}
                fill={palette.cardInk}
              >
                {mark.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
