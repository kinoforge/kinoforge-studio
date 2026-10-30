import { BOARD_ICONS } from "../icons/index.ts";
import { Ease } from "../pieces/ease.ts";
import { BOARD_MONO, type BoardPalette } from "../theme.ts";
import { type Box, FitText } from "../timeline.ts";
import { DiagramLayout, type Point } from "./layout.ts";
import { MARK_COLORS, type StageNode } from "./spec.ts";
import type { DiagramScript, Ring, Span } from "./state.ts";

/** A node's look when the stage never named it: its id read as words. */
class NodeNames {
  static of(id: string, stage: ReadonlyMap<string, StageNode>): StageNode | { label: string } {
    const named = stage.get(id);
    if (named) return named;
    const words = id.replace(/-/g, " ");
    return { label: words.charAt(0).toUpperCase() + words.slice(1) };
  }
}

/** How far into the scene something stands: 0 before it came, 1 while it shows, back to 0 as
 *  it leaves. Things there from the start fade in only when the scene does not glide. */
class Presence {
  static of(span: Span, t: number, carried: number): { p: number; gone: number } {
    if (span.enter != null && t < span.enter) return { p: 0, gone: 0 };
    const p = span.enter == null ? carried : Ease.pop(t - span.enter, 0.45);
    const gone = span.leave == null ? 0 : Ease.out(t - span.leave, 0.4);
    return { p, gone };
  }
}

class Glide {
  static readonly SECONDS = 0.8;

  static box(from: Box | undefined, to: Box, t: number): Box {
    if (!from) return to;
    const p = Ease.out(t, Glide.SECONDS);
    const mix = (a: number, b: number) => a + (b - a) * p;
    return {
      x: mix(from.x, to.x),
      y: mix(from.y, to.y),
      w: mix(from.w, to.w),
      h: mix(from.h, to.h),
    };
  }
}

function DiagramNode({
  id,
  box,
  look,
  presence,
  ring,
  age,
  bump,
  palette,
}: {
  id: string;
  box: Box;
  look: StageNode | { label: string };
  presence: { p: number; gone: number };
  ring: Ring | undefined;
  age: number;
  bump: number;
  palette: BoardPalette;
}) {
  const icon = "icon" in look ? BOARD_ICONS[look.icon]?.icon : undefined;
  const detail = "detail" in look ? look.detail : undefined;
  const tone = ring ? palette[MARK_COLORS[ring.tone]] : null;
  const label = FitText.size(
    look.label,
    { w: box.w * 0.88, h: box.h * (detail ? 0.3 : 0.42) },
    Math.round(box.h * 0.18),
    2,
  );
  const small = FitText.size(
    detail ?? "",
    { w: box.w * 0.9, h: box.h * 0.16 },
    Math.round(box.h * 0.1),
    1,
    FitText.MONO,
  );
  const p = Ease.clamp(presence.p);
  const scale = (0.6 + 0.4 * presence.p) * (1 - 0.2 * presence.gone) * (1 + bump);
  const dim = ring?.tone === "bad" ? 0.55 : 1;
  const edge = Math.max(2, box.h * 0.025);
  return (
    <div
      data-node={id}
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        boxSizing: "border-box",
        borderRadius: box.h * 0.14,
        background: palette.card,
        border: `${edge}px solid ${tone ?? `${palette.accent2}8C`}`,
        boxShadow: tone
          ? `0 0 0 ${edge * 2}px ${tone}40, 0 ${box.h * 0.04}px ${box.h * 0.12}px ${palette.shadow}`
          : `0 ${box.h * 0.04}px ${box.h * 0.12}px ${palette.shadow}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: box.h * 0.04,
        opacity: p * (1 - presence.gone),
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          opacity: dim,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: box.h * 0.04,
        }}
      >
        {icon
          ? (() => {
              const Icon = icon;
              return <Icon size={box.h * 0.34} color={tone ?? palette.accent} strokeWidth={2.2} />;
            })()
          : null}
        <div
          style={{
            fontSize: label,
            fontWeight: 800,
            lineHeight: 1.1,
            color: palette.cardInk,
            textAlign: "center",
            maxWidth: box.w * 0.9,
          }}
        >
          {look.label}
        </div>
        {detail ? (
          <div
            style={{
              fontFamily: BOARD_MONO,
              fontSize: small,
              color: palette.muted,
              whiteSpace: "nowrap",
            }}
          >
            {detail}
          </div>
        ) : null}
      </div>
      {ring?.label ? (
        <div
          style={{
            position: "absolute",
            top: -box.h * 0.16,
            right: -box.w * 0.08,
            padding: `${box.h * 0.03}px ${box.h * 0.08}px`,
            borderRadius: box.h * 0.1,
            background: tone ?? palette.accent2,
            color: "#fff",
            fontSize: Math.round(box.h * 0.12),
            fontWeight: 800,
            whiteSpace: "nowrap",
            transform: `scale(${Ease.pop(age, 0.35)})`,
          }}
        >
          {ring.label}
        </div>
      ) : null}
    </div>
  );
}

/** Where each arrow's label sits along it: halfway, or nearer one end when that keeps it off
 *  a label already placed. */
class LabelSpots {
  static readonly SPOTS = [0.5, 0.3, 0.7, 0.2, 0.8];

  static of(
    arrows: readonly { key: string; a: Point; b: Point; label?: string }[],
    stroke: number,
  ) {
    const taken: Box[] = [];
    const out = new Map<string, number>();
    for (const { key, a, b, label } of arrows) {
      if (!label) continue;
      const w = label.length * FitText.SANS * stroke * 6 + stroke * 5;
      const h = stroke * 9;
      const at = (p: number): Box => ({
        x: a.x + (b.x - a.x) * p - w / 2,
        y: a.y + (b.y - a.y) * p - h / 2,
        w,
        h,
      });
      const clear = (box: Box) => !taken.some((other) => LabelSpots.overlap(box, other));
      const spot = LabelSpots.SPOTS.find((p) => clear(at(p))) ?? 0.5;
      taken.push(at(spot));
      out.set(key, spot);
    }
    return out;
  }

  private static overlap(a: Box, b: Box): boolean {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }
}

function Arrow({
  a,
  b,
  draw,
  fade,
  label,
  spot,
  stroke,
  palette,
}: {
  a: Point;
  b: Point;
  draw: number;
  fade: number;
  label?: string;
  spot: number;
  stroke: number;
  palette: BoardPalette;
}) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 1) return null;
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const head = stroke * 4.2;
  const tip = { x: a.x + ux * length * draw, y: a.y + uy * length * draw };
  const back = { x: tip.x - ux * head, y: tip.y - uy * head };
  const side = { x: -uy * head * 0.55, y: ux * head * 0.55 };
  const color = palette.muted;
  const mid = { x: a.x + (b.x - a.x) * spot, y: a.y + (b.y - a.y) * spot };
  return (
    <g opacity={1 - fade}>
      <line
        x1={a.x}
        y1={a.y}
        x2={back.x}
        y2={back.y}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <polygon
        points={`${tip.x},${tip.y} ${back.x + side.x},${back.y + side.y} ${back.x - side.x},${back.y - side.y}`}
        fill={color}
        opacity={Ease.clamp((draw - 0.6) / 0.4)}
      />
      {label && draw > 0.95 ? (
        <foreignObject x={mid.x - 160} y={mid.y - stroke * 9} width={320} height={stroke * 18}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <span
              style={{
                fontSize: stroke * 6,
                fontWeight: 700,
                color: palette.ink,
                background: palette.background,
                padding: `${stroke}px ${stroke * 2.5}px`,
                borderRadius: stroke * 3,
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </span>
          </div>
        </foreignObject>
      ) : null}
    </g>
  );
}

/** One scene's diagram at time `t`: nodes laid out by DiagramLayout (gliding from where the
 *  previous scene had them), arrows drawing in, packets on their trips and rings on marks. */
export function DiagramView({
  script,
  boxes,
  from,
  stage,
  t,
  palette,
}: {
  script: DiagramScript;
  boxes: ReadonlyMap<string, Box>;
  from: ReadonlyMap<string, Box> | null;
  stage: ReadonlyMap<string, StageNode>;
  t: number;
  palette: BoardPalette;
}) {
  const carried = from ? 1 : Ease.out(t, 0.4);
  const placed = new Map<string, Box>();
  for (const id of script.order) {
    const target = boxes.get(id);
    if (!target) continue;
    const span = script.nodes.get(id);
    placed.set(id, span?.enter == null ? Glide.box(from?.get(id), target, t) : target);
  }
  const unit = Math.min(...[...placed.values()].map((box) => box.h), 400);
  const stroke = Math.max(2.5, unit * 0.028);
  const gap = stroke * 2;
  const shows = (id: string) => {
    const span = script.nodes.get(id);
    return !!span && (span.enter == null || t >= span.enter);
  };

  const arrivals = new Map<string, number[]>();
  for (const trip of script.trips) {
    trip.hops.forEach((hop, k) => {
      const at = trip.at + (k + 1) * trip.hop;
      arrivals.set(hop.to, [...(arrivals.get(hop.to) ?? []), at]);
    });
  }
  const bump = (id: string) =>
    Math.max(
      0,
      ...(arrivals.get(id) ?? []).map((at) =>
        t >= at && t < at + 0.35 ? Math.sin(((t - at) / 0.35) * Math.PI) * 0.07 : 0,
      ),
    );

  const arrows = script.arrows.flatMap((link) => {
    const a = placed.get(link.from);
    const b = placed.get(link.to);
    if (!a || !b || !shows(link.from) || !shows(link.to)) return [];
    const key = `${link.from}>${link.to}`;
    const span = script.links.get(key);
    if (!span || (span.enter != null && t < span.enter)) return [];
    const [start, end] = DiagramLayout.ends(a, b, gap);
    return [
      {
        key,
        a: start,
        b: end,
        label: link.label,
        draw: span.enter == null ? carried : Ease.out(t - span.enter, 0.45),
        fade: span.leave == null ? 0 : Ease.out(t - span.leave, 0.4),
      },
    ];
  });
  const spots = LabelSpots.of(arrows, stroke);

  return (
    <>
      <svg
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
        width="100%"
        height="100%"
      >
        {arrows.map(({ key, a, b, label, draw, fade }) => (
          <Arrow
            key={key}
            a={a}
            b={b}
            draw={draw}
            fade={fade}
            label={label}
            spot={spots.get(key) ?? 0.5}
            stroke={stroke}
            palette={palette}
          />
        ))}
        {script.trips.map((trip, i) => {
          const local = t - trip.at;
          const total = trip.hops.length * trip.hop;
          if (local < 0 || local > total + 0.25) return null;
          const k = Math.min(trip.hops.length - 1, Math.floor(local / trip.hop));
          const hop = trip.hops[k];
          const a = placed.get(hop.from);
          const b = placed.get(hop.to);
          if (!a || !b) return null;
          const [start, end] = DiagramLayout.ends(a, b, gap);
          const f = Ease.clamp((local - k * trip.hop) / trip.hop);
          const s = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
          const at = { x: start.x + (end.x - start.x) * s, y: start.y + (end.y - start.y) * s };
          const r = stroke * 3.4;
          const fade = 1 - Ease.clamp((local - total) / 0.25);
          return (
            <g key={i} opacity={fade}>
              <circle cx={at.x} cy={at.y} r={r * 2.2} fill={palette.accent} opacity={0.22} />
              <circle cx={at.x} cy={at.y} r={r} fill={palette.accent} />
              {trip.label ? (
                <foreignObject x={at.x - 160} y={at.y - r * 6.5} width={320} height={r * 4}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <span
                      style={{
                        fontFamily: BOARD_MONO,
                        fontSize: r * 1.7,
                        fontWeight: 700,
                        color: palette.background,
                        background: palette.accent,
                        padding: `${r * 0.2}px ${r * 0.6}px`,
                        borderRadius: r * 0.6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {trip.label}
                    </span>
                  </div>
                </foreignObject>
              ) : null}
            </g>
          );
        })}
      </svg>
      {script.order.map((id) => {
        const box = placed.get(id);
        const span = script.nodes.get(id);
        if (!box || !span) return null;
        const presence = Presence.of(span, t, carried);
        if (presence.p <= 0 && span.enter != null) return null;
        const ring = script.rings.filter((r) => r.node === id && t >= r.at && t < r.until).at(-1);
        return (
          <DiagramNode
            key={id}
            id={id}
            box={box}
            look={NodeNames.of(id, stage)}
            presence={presence}
            ring={ring}
            age={ring ? t - ring.at : 0}
            bump={bump(id)}
            palette={palette}
          />
        );
      })}
    </>
  );
}
