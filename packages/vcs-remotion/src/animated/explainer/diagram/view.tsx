import { BoardGlyph } from "../../shared/elements/glyph.tsx";
import { Ease } from "../../shared/ease.ts";
import { BOARD_MONO, type BoardPalette } from "../../shared/theme.ts";
import { type Box } from "../timeline.ts";
import { FitText } from "../../shared/fit-text.ts";
import { LabelPlaces, type LabelSpot } from "./labels.ts";
import type { Point } from "./layout.ts";
import { DiagramRoutes, Route } from "./route.ts";
import { MARK_COLORS, type StageNode } from "./spec.ts";
import type { DiagramScript, Ring, Span } from "./state.ts";

class NodeRow {
  static readonly WIDE = 2;
  static readonly ICON = 0.56;
  static readonly INSET = 0.18;
  static readonly GAP = 0.12;
}

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
  const icon = "icon" in look ? look.icon : undefined;
  const detail = "detail" in look ? look.detail : undefined;
  const tone = ring ? palette[MARK_COLORS[ring.tone]] : null;
  const row = icon != null && box.w >= box.h * NodeRow.WIDE;
  const glyph = box.h * (row ? NodeRow.ICON : 0.34);
  const textW = row ? box.w - glyph - box.h * (NodeRow.INSET * 2 + NodeRow.GAP) : box.w * 0.88;
  const label = FitText.size(
    look.label,
    { w: textW, h: box.h * (row ? (detail ? 0.5 : 0.76) : detail ? 0.3 : 0.42) },
    Math.round(box.h * (row ? 0.26 : 0.18)),
    2,
  );
  const small = FitText.size(
    detail ?? "",
    { w: textW, h: box.h * (row ? 0.22 : 0.16) },
    Math.round(box.h * (row ? 0.14 : 0.1)),
    1,
    "mono",
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
        alignItems: row ? "flex-start" : "center",
        justifyContent: "center",
        paddingLeft: row ? box.h * NodeRow.INSET : 0,
        gap: box.h * 0.04,
        opacity: p * (1 - presence.gone),
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          opacity: dim,
          display: "flex",
          flexDirection: row ? "row" : "column",
          alignItems: "center",
          gap: box.h * (row ? NodeRow.GAP : 0.04),
        }}
      >
        <BoardGlyph name={icon} size={glyph} color={tone ?? palette.accent} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: row ? "flex-start" : "center",
            gap: box.h * 0.04,
            maxWidth: textW,
          }}
        >
          <div
            style={{
              fontSize: label,
              fontWeight: 800,
              lineHeight: 1.1,
              color: palette.cardInk,
              textAlign: row ? "left" : "center",
              maxWidth: textW,
              ...FitText.clamp(2),
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
                ...FitText.line(),
                maxWidth: textW,
              }}
            >
              {detail}
            </div>
          ) : null}
        </div>
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

function Tag({
  at,
  text,
  size,
  pad,
  ink,
  fill,
  mono,
  opacity,
}: {
  at: Point;
  text: string;
  size: number;
  pad: [number, number];
  ink: string;
  fill: string;
  mono?: boolean;
  opacity: number;
}) {
  return (
    <foreignObject
      x={at.x - 240}
      y={at.y - size * 2}
      width={480}
      height={size * 4}
      opacity={opacity}
    >
      <div
        style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}
      >
        <span
          style={{
            fontFamily: mono ? BOARD_MONO : undefined,
            fontSize: size,
            fontWeight: 700,
            lineHeight: 1.25,
            color: ink,
            background: fill,
            padding: `${pad[0]}px ${pad[1]}px`,
            borderRadius: size * 0.45,
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </span>
      </div>
    </foreignObject>
  );
}

function Arrow({
  route,
  draw,
  fade,
  stroke,
  palette,
}: {
  route: Route;
  draw: number;
  fade: number;
  stroke: number;
  palette: BoardPalette;
}) {
  const length = route.length;
  if (length < 1) return null;
  const head = stroke * 4.2;
  const reach = Ease.clamp(draw);
  const tip = route.at(reach);
  const behind = route.at(Math.max(0, reach - head / length));
  const run = Math.hypot(tip.x - behind.x, tip.y - behind.y) || 1;
  const ux = (tip.x - behind.x) / run;
  const uy = (tip.y - behind.y) / run;
  const back = { x: tip.x - ux * head, y: tip.y - uy * head };
  const side = { x: -uy * head * 0.55, y: ux * head * 0.55 };
  const color = palette.muted;
  const line = [...route.until(Math.max(0, reach - head / length)), back]
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  return (
    <g opacity={1 - fade}>
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`${tip.x},${tip.y} ${back.x + side.x},${back.y + side.y} ${back.x - side.x},${back.y - side.y}`}
        fill={color}
        opacity={Ease.clamp((draw - 0.6) / 0.4)}
      />
    </g>
  );
}

/** One scene's diagram at time `t`: nodes laid out by DiagramLayout (gliding from where the
 *  previous scene had them), arrows drawing in, packets on their trips and rings on marks. */
export function DiagramView({
  script,
  boxes,
  from,
  wide,
  fromWide,
  area,
  stage,
  t,
  palette,
}: {
  script: DiagramScript;
  boxes: ReadonlyMap<string, Box>;
  from: ReadonlyMap<string, Box> | null;
  area: Box;
  wide: boolean;
  fromWide: boolean;
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

  const routes = DiagramRoutes.of(script.arrows, boxes, wide, gap);
  const glide = from ? Ease.out(t, Glide.SECONDS) : 1;
  const earlier = glide < 1 && from ? DiagramRoutes.of(script.arrows, from, fromWide, gap) : null;
  const routeOf = (key: string): Route | undefined => {
    const route = routes.get(key);
    const before = earlier?.get(key);
    const span = script.links.get(key);
    if (!route || !before || span?.enter != null) return route;
    return Route.blend(before, route, glide);
  };
  const arrows = script.arrows.flatMap((link) => {
    if (!shows(link.from) || !shows(link.to)) return [];
    const key = `${link.from}>${link.to}`;
    const span = script.links.get(key);
    if (!span || (span.enter != null && t < span.enter)) return [];
    const route = routeOf(key);
    if (!route) return [];
    return [
      {
        key,
        route,
        label: link.label,
        draw: span.enter == null ? carried : Ease.out(t - span.enter, 0.45),
        fade: span.leave == null ? 0 : Ease.out(t - span.leave, 0.4),
      },
    ];
  });

  const tagSize = stroke * 6;
  const tagPad: [number, number] = [stroke, stroke * 2.5];
  const tagBox = (text: string, size: number, pad: [number, number], mono = false) => ({
    w: FitText.width(text, size, mono ? "mono" : "sans") + pad[1] * 2,
    h: size * FitText.LEADING + pad[0] * 2,
  });
  const places = new LabelPlaces(
    [...boxes.values()].map((b) => ({
      x: b.x - gap,
      y: b.y - gap,
      w: b.w + gap * 2,
      h: b.h + gap * 2,
    })),
    area,
    gap,
  );
  const labelSpots = new Map<string, LabelSpot>();
  for (const link of script.arrows) {
    const key = `${link.from}>${link.to}`;
    const route = routes.get(key);
    if (!link.label || !route) continue;
    const { w, h } = tagBox(link.label, tagSize, tagPad);
    labelSpots.set(key, places.arrow(route, w, h));
  }
  const dot = stroke * 3.4;
  const tripSize = dot * 1.7;
  const tripPad: [number, number] = [dot * 0.2, dot * 0.6];
  const trips = script.trips.flatMap((trip, i) => {
    const local = t - trip.at;
    const total = trip.hops.length * trip.hop;
    if (local < 0 || local > total + 0.25) return [];
    const k = Math.min(trip.hops.length - 1, Math.floor(local / trip.hop));
    const hop = trip.hops[k];
    const key = `${hop.from}>${hop.to}`;
    const route = routeOf(key);
    if (!route) return [];
    const f = Ease.clamp((local - k * trip.hop) / trip.hop);
    const s = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
    const fade = 1 - Ease.clamp((local - total) / 0.25);
    const size = trip.label ? tagBox(trip.label, tripSize, tripPad, true) : null;
    const reach = dot * 2.4;
    const side = size ? places.trip(routes.get(key) ?? route, size.w, size.h, reach) : 1;
    const tag = size ? places.ride(route, s, side, size.w, size.h, reach) : null;
    return [{ i, at: route.at(s), fade, label: trip.label, tag }];
  });

  return (
    <>
      <svg
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
        width="100%"
        height="100%"
      >
        {arrows.map(({ key, route, draw, fade }) => (
          <Arrow
            key={key}
            route={route}
            draw={draw}
            fade={fade}
            stroke={stroke}
            palette={palette}
          />
        ))}
        {trips.map(({ i, at, fade }) => (
          <g key={i} opacity={fade}>
            <circle cx={at.x} cy={at.y} r={dot * 2.2} fill={palette.accent} opacity={0.22} />
            <circle cx={at.x} cy={at.y} r={dot} fill={palette.accent} />
          </g>
        ))}
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
      <svg
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
        width="100%"
        height="100%"
      >
        {arrows.map(({ key, route, label, draw, fade }) => {
          const spot = labelSpots.get(key);
          if (!label || !spot || draw <= 0.95) return null;
          const { w, h } = tagBox(label, tagSize, tagPad);
          return (
            <Tag
              key={key}
              at={LabelPlaces.at(route, spot, w, h, gap)}
              text={label}
              size={tagSize}
              pad={tagPad}
              ink={palette.ink}
              fill={palette.background}
              opacity={1 - fade}
            />
          );
        })}
        {trips.map(({ i, fade, label, tag }) =>
          label && tag ? (
            <Tag
              key={i}
              at={{ x: tag.x + tag.w / 2, y: tag.y + tag.h / 2 }}
              text={label}
              size={tripSize}
              pad={tripPad}
              ink={palette.background}
              fill={palette.accent}
              mono
              opacity={fade}
            />
          ) : null,
        )}
      </svg>
    </>
  );
}
