import type { ReactNode } from "react";
import { HandFont } from "./hand/font.ts";
import type { Ink, TextInk } from "./ink/ink.ts";
import type { Point } from "./ink/path.ts";
import type { View } from "./camera.ts";
import type { WbPalette } from "./theme.ts";

const BASE = 0.95;

export class InkClock {
  static readonly FADE = 0.25;
  static share(ink: Ink, t: number): number {
    if (t >= ink.to) return 1;
    const x = Math.min(1, Math.max(0, (t - ink.from) / Math.max(0.001, ink.to - ink.from)));
    return ink.kind === "line" ? x * x * (3 - 2 * x) * 0.35 + x * 0.65 : x;
  }

  static textTip(ink: TextInk, share: number): Point {
    const total = ink.widths.reduce((sum, w) => sum + w, 0) || 1;
    let left = share * total;
    for (let i = 0; i < ink.lines.length; i++) {
      const w = ink.widths[i];
      if (left <= w || i === ink.lines.length - 1) {
        const x0 = ink.align === "middle" ? ink.x - w / 2 : ink.x;
        return [x0 + Math.min(w, left), ink.y + ink.size * (HandFont.LEADING * i + BASE) - ink.size * 0.3];
      }
      left -= w;
    }
    return [ink.x, ink.y];
  }

  static tip(ink: Ink, t: number): Point | null {
    const share = InkClock.share(ink, t);
    if (ink.kind === "line") return ink.path.point(share);
    if (ink.kind === "text") return InkClock.textTip(ink, share);
    return null;
  }
}

function TextView({ ink, share, id }: { ink: TextInk; share: number; id: string }) {
  const font = HandFont.css(ink.weight);
  const total = ink.widths.reduce((sum, w) => sum + w, 0) || 1;
  let before = 0;
  const shown = ink.count
    ? `${ink.count.prefix}${(ink.count.from + (ink.count.to - ink.count.from) * (1 - (1 - share) ** 3)).toFixed(ink.count.decimals)}${ink.count.suffix}`
    : null;
  return (
    <g>
      {ink.lines.map((line, i) => {
        const w = ink.widths[i];
        const lineShare = Math.min(1, Math.max(0, (share * total - before) / Math.max(1, w)));
        before += w;
        if (lineShare <= 0 && !shown) return null;
        const y = ink.y + ink.size * (HandFont.LEADING * i + BASE);
        const x0 = ink.align === "middle" ? ink.x - w / 2 : ink.x;
        const clip = `${id}-${i}`;
        const whole = shown || lineShare >= 1;
        return (
          <g key={i}>
            {!whole && (
              <clipPath id={clip}>
                <rect x={x0 - ink.size * 0.3} y={y - ink.size * 1.3} width={w * lineShare + ink.size * 0.3} height={ink.size * 1.8} />
              </clipPath>
            )}
            <text
              x={ink.x}
              y={y}
              fill={ink.color}
              fontSize={ink.size}
              textAnchor={ink.align}
              clipPath={whole ? undefined : `url(#${clip})`}
              opacity={shown ? Math.min(1, share * 4) : 1}
              style={font}
            >
              {shown ?? line}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function InkView({ ink, t, id }: { ink: Ink; t: number; id: string }) {
  if (t < ink.from) return null;
  const gone = ink.off == null ? 0 : Math.min(1, Math.max(0, (t - ink.off) / InkClock.FADE));
  if (gone >= 1) return null;
  const share = InkClock.share(ink, t);
  const placed = (child: ReactNode) =>
    "place" in ink && ink.place ? (
      <g transform={`translate(${ink.place.x} ${ink.place.y}) scale(${ink.place.s})`}>{child}</g>
    ) : (
      child
    );
  switch (ink.kind) {
    case "line":
      return placed(
        <path
          d={ink.d}
          fill="none"
          stroke={ink.color}
          strokeWidth={ink.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={1 - gone}
          {...(share < 1 ? { pathLength: 1, strokeDasharray: "1 1", strokeDashoffset: 1 - share } : {})}
        />,
      );
    case "fill":
      return placed(<path d={ink.d} fill={ink.color} opacity={ink.opacity * share} fillRule={ink.evenodd ? "evenodd" : undefined} />);
    case "text":
      return <TextView ink={ink} share={share} id={id} />;
    case "dot": {
      if (t > ink.to + 0.3) return null;
      const [x, y] = ink.path.point(share);
      const fade = t > ink.to ? 1 - (t - ink.to) / 0.3 : Math.min(1, share * 8);
      const label = ink.label;
      return (
        <g opacity={fade}>
          <circle cx={x} cy={y} r={ink.r} fill={ink.color} />
          {label && (
            <text x={x + ink.r * 1.8} y={y - ink.r * 0.6} fill={ink.color} fontSize={label.size} stroke={ink.halo} strokeWidth={label.size * 0.22} paintOrder="stroke" style={HandFont.css("bold")}>
              {label.text}
            </text>
          )}
        </g>
      );
    }
  }
}

export class MarkerPath {
  static readonly REST = 0.35;
  static readonly TRAVEL = 0.6;

  constructor(private readonly pen: readonly Ink[]) {}

  static of(inks: readonly Ink[]): MarkerPath {
    return new MarkerPath(inks.filter((ink) => ink.kind === "line" || ink.kind === "text").sort((a, b) => a.from - b.from));
  }

  at(t: number, view: View, w: number, h: number): { tip: Point; color: string; down: boolean } {
    const screen = ([x, y]: Point): Point => [(x - view.cx) * view.zoom + w / 2, (y - view.cy) * view.zoom + h / 2];
    const rest: Point = [w * 1.18, h * 1.12];
    let prev: Ink | null = null;
    let next: Ink | null = null;
    let active: Ink | null = null;
    for (const ink of this.pen) {
      if (ink.from <= t && t < ink.to) active = ink;
      if (ink.to <= t && (!prev || ink.to > prev.to)) prev = ink;
      if (ink.from > t && !next) next = ink;
    }
    if (active) return { tip: screen(InkClock.tip(active, t) as Point), color: MarkerPath.color(active), down: true };
    const end = prev ? screen(InkClock.tip(prev, prev.to) as Point) : rest;
    const start = next ? screen(InkClock.tip(next, next.from) as Point) : rest;
    const lerp = (a: Point, b: Point, k: number): Point => {
      const e = k * k * (3 - 2 * k);
      return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
    };
    const color = MarkerPath.color(next ?? prev);
    if (prev && next && next.from - prev.to <= MarkerPath.TRAVEL)
      return { tip: lerp(end, start, (t - prev.to) / (next.from - prev.to)), color, down: false };
    if (prev && t - prev.to < MarkerPath.REST) return { tip: lerp(end, rest, (t - prev.to) / MarkerPath.REST), color, down: false };
    if (next && next.from - t < MarkerPath.REST) return { tip: lerp(rest, start, 1 - (next.from - t) / MarkerPath.REST), color, down: false };
    return { tip: rest, color, down: false };
  }

  private static color(ink: Ink | null): string {
    return ink && "color" in ink ? ink.color : "#1f2329";
  }
}

export function Marker({ tip, color, down, unit, palette, t }: { tip: Point; color: string; down: boolean; unit: number; palette: WbPalette; t: number }) {
  const length = unit * 0.34;
  const girth = unit * 0.05;
  const lift = down ? 0 : unit * 0.012;
  const sway = Math.sin(t * 7.3) * 2.2 + (down ? Math.sin(t * 23) * 1.2 : 0);
  return (
    <g transform={`translate(${tip[0]} ${tip[1] - lift}) rotate(${-38 + sway})`} style={{ filter: `drop-shadow(${unit * 0.012}px ${unit * 0.018}px ${unit * 0.012}px rgba(0,0,0,0.25))` }}>
      <path d={`M0 0 L${girth * 0.42} ${-girth * 0.22} L${girth * 0.42} ${girth * 0.22} Z`} fill={color} />
      <rect x={girth * 0.38} y={-girth * 0.3} width={girth * 0.5} height={girth * 0.6} rx={girth * 0.08} fill={color} />
      <rect x={girth * 0.8} y={-girth / 2} width={length} height={girth} rx={girth * 0.28} fill={palette.marker.body} stroke="rgba(0,0,0,0.18)" strokeWidth={unit * 0.002} />
      <rect x={girth * 0.8 + length * 0.18} y={-girth / 2} width={length * 0.1} height={girth} fill={palette.marker.band} />
      <rect x={girth * 0.8 + length * 0.72} y={-girth / 2} width={length * 0.28} height={girth} rx={girth * 0.28} fill={color} />
    </g>
  );
}
