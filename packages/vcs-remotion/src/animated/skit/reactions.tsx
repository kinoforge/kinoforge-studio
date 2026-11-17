import { Ease } from "../shared/ease.ts";
import { BOARD_FONT, type BoardPalette } from "../shared/theme.ts";
import type { Reaction } from "./spec.ts";

export class ReactionTiming {
  static readonly IN = 0.35;
  static readonly OUT = 0.3;

  static shown(t: number, from: number, until: number): number {
    if (t < from) return 0;
    const rise = Ease.pop(t, ReactionTiming.IN, from);
    const fall = 1 - Ease.out(t, ReactionTiming.OUT, until - ReactionTiming.OUT);
    return Math.max(0, Math.min(rise, fall));
  }
}

function Flame({ x, size, t, seed }: { x: number; size: number; t: number; seed: number }) {
  const flick = 1 + 0.18 * Math.sin(t * 13 + seed * 2.1);
  const h = size * flick;
  return (
    <g transform={`translate(${x} 0)`}>
      <path
        d={`M 0 0 C ${-h * 0.5} ${-h * 0.25} ${-h * 0.25} ${-h * 0.75} 0 ${-h} C ${h * 0.25} ${-h * 0.75} ${h * 0.5} ${-h * 0.25} 0 0 Z`}
        fill="#F28C28"
      />
      <path
        d={`M 0 0 C ${-h * 0.25} ${-h * 0.15} ${-h * 0.12} ${-h * 0.45} 0 ${-h * 0.6} C ${h * 0.12} ${-h * 0.45} ${h * 0.25} ${-h * 0.15} 0 0 Z`}
        fill="#F2C511"
      />
    </g>
  );
}

function Star({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  const points = Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 4) * i;
    const d = i % 2 ? r * 0.35 : r;
    return `${x + Math.sin(a) * d},${y - Math.cos(a) * d}`;
  }).join(" ");
  return <polygon points={points} fill={color} />;
}

export function ReactionMark({
  reaction,
  x,
  y,
  size,
  shown,
  t,
  palette,
}: {
  reaction: Reaction;
  x: number;
  y: number;
  size: number;
  shown: number;
  t: number;
  palette: BoardPalette;
}) {
  if (shown <= 0) return null;
  const s = size;
  const bob = Math.sin(t * 4) * s * 0.06;
  const glyph = (text: string, color: string, dx: number, dy: number, scale = 1) => (
    <text
      x={x + dx}
      y={y + dy + bob}
      fontFamily={BOARD_FONT}
      fontWeight={900}
      fontSize={s * scale}
      fill={color}
      textAnchor="middle"
      stroke={palette.background}
      strokeWidth={s * 0.06}
      paintOrder="stroke"
    >
      {text}
    </text>
  );
  const body = (() => {
    switch (reaction) {
      case "question":
        return glyph("?", palette.accent2, s * 0.75, -s * 0.55);
      case "exclaim":
        return glyph("!", palette.warn, s * 0.7, -s * 0.5, 1.1);
      case "sweat": {
        const drop = (t * 0.9) % 1;
        return (
          <path
            transform={`translate(${x + s * 0.62} ${y - s * 0.45 + drop * s * 0.5})`}
            d={`M 0 ${-s * 0.32} C ${s * 0.2} ${-s * 0.05} ${s * 0.22} ${s * 0.12} 0 ${s * 0.18} C ${-s * 0.22} ${s * 0.12} ${-s * 0.2} ${-s * 0.05} 0 ${-s * 0.32} Z`}
            fill="#7FC8F8"
            opacity={1 - drop * 0.6}
          />
        );
      }
      case "stress": {
        const pulse = 1 + 0.15 * Math.sin(t * 10);
        const r = s * 0.22 * pulse;
        const cx = x + s * 0.55;
        const cy = y - s * 0.75;
        return (
          <g stroke={palette.bad} strokeWidth={s * 0.08} strokeLinecap="round" fill="none">
            {[0, 1, 2, 3].map((i) => {
              const a = (Math.PI / 2) * i + Math.PI / 4;
              const ox = Math.cos(a) * r * 1.3;
              const oy = Math.sin(a) * r * 1.3;
              return (
                <path
                  key={i}
                  d={`M ${cx + ox - Math.sin(a) * r * 0.6} ${cy + oy + Math.cos(a) * r * 0.6} Q ${cx + ox * 0.5} ${cy + oy * 0.5} ${cx + ox + Math.sin(a) * r * 0.6} ${cy + oy - Math.cos(a) * r * 0.6}`}
                />
              );
            })}
          </g>
        );
      }
      case "fire":
        return (
          <g transform={`translate(${x} ${y - s * 0.75})`}>
            <Flame x={-s * 0.32} size={s * 0.55} t={t} seed={1} />
            <Flame x={0} size={s * 0.8} t={t} seed={2} />
            <Flame x={s * 0.32} size={s * 0.55} t={t} seed={3} />
          </g>
        );
      case "idea": {
        const glow = 0.5 + 0.5 * Math.abs(Math.sin(t * 3));
        const cx = x;
        const cy = y - s * 1.25;
        return (
          <g>
            <circle cx={cx} cy={cy} r={s * 0.5} fill={palette.warn} opacity={0.2 * glow} />
            <circle cx={cx} cy={cy} r={s * 0.28} fill={palette.warn} />
            <rect
              x={cx - s * 0.12}
              y={cy + s * 0.24}
              width={s * 0.24}
              height={s * 0.16}
              rx={s * 0.04}
              fill={palette.muted}
            />
          </g>
        );
      }
      case "sparkle":
        return (
          <g>
            {[
              [-0.7, -0.6, 0.2, 0],
              [0.75, -0.85, 0.26, 1.3],
              [0.15, -1.25, 0.16, 2.4],
            ].map(([dx, dy, r, phase]) => (
              <Star
                key={phase}
                x={x + dx * s}
                y={y + dy * s}
                r={s * r * (0.7 + 0.3 * Math.abs(Math.sin(t * 4 + phase)))}
                color={palette.warn}
              />
            ))}
          </g>
        );
      case "zzz":
        return (
          <g>
            {[0, 1, 2].map((i) => {
              const k = (t * 0.6 + i / 3) % 1;
              return (
                <text
                  key={i}
                  x={x + s * (0.5 + k * 0.6)}
                  y={y - s * (0.4 + k * 0.9)}
                  fontFamily={BOARD_FONT}
                  fontWeight={800}
                  fontSize={s * (0.35 + k * 0.3)}
                  fill={palette.muted}
                  opacity={1 - k}
                >
                  z
                </text>
              );
            })}
          </g>
        );
    }
  })();
  return (
    <g
      opacity={Math.min(1, shown)}
      transform={`translate(${x} ${y}) scale(${Math.max(0.01, shown)}) translate(${-x} ${-y})`}
    >
      {body}
    </g>
  );
}
