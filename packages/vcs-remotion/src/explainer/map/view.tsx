import { MARK_COLORS } from "../diagram/spec.ts";
import { Ease } from "../pieces/ease.ts";
import { BOARD_FONT, type BoardPalette } from "../theme.ts";
import { FitText } from "../timeline.ts";
import { GreatCircle, type MapView, MapViews, Projection, World, type XY } from "./geo.ts";
import type { MapPlan } from "./scene.ts";
import type { RouteMode } from "./spec.ts";

/** Each country as one SVG path in projected units, built once. */
class CountryPaths {
  private static cache: Map<string, string> | null = null;

  static all(): Map<string, string> {
    if (CountryPaths.cache) return CountryPaths.cache;
    CountryPaths.cache = new Map(
      [...World.countries().values()].map((country) => [
        country.code,
        country.rings
          .map((ring) => `M${ring.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).join("L")}Z`)
          .join(""),
      ]),
    );
    return CountryPaths.cache;
  }
}

class MapInk {
  static of(palette: BoardPalette) {
    return palette.light
      ? { land: "#E2D6C1", border: "#BBAA8E", line: palette.accent }
      : { land: `${palette.ink}1C`, border: `${palette.ink}45`, line: palette.accent };
  }
}

class MapMotion {
  /** The view at a time: gliding from the last scene's, then to each region asked for. */
  static at(plan: MapPlan, t: number): MapView {
    let view = plan.views[0].view;
    if (plan.from) view = MapViews.mix(plan.from, view, Ease.out(t, 1.1));
    for (const step of plan.views.slice(1)) {
      if (step.at == null || t < step.at) break;
      view = MapViews.mix(view, step.view, Ease.out(t - step.at, 1.2));
    }
    return view;
  }
}

function Marker({
  mode,
  at,
  angle,
  size,
  color,
}: {
  mode: RouteMode;
  at: XY;
  angle: number;
  size: number;
  color: string;
}) {
  if (mode === "line") return null;
  const turn = `translate(${at.x} ${at.y}) rotate(${(angle * 180) / Math.PI}) scale(${size / 20})`;
  if (mode === "plane") {
    return (
      <g transform={turn}>
        <path
          d="M 12 0 L 4 -2 L -2 -11 L -5 -11 L -1 -2 L -8 -1.5 L -11 -5 L -13 -5 L -11 0 L -13 5 L -11 5 L -8 1.5 L -1 2 L -5 11 L -2 11 L 4 2 Z"
          fill={color}
          stroke="#FFFFFF"
          strokeWidth={1.4}
        />
      </g>
    );
  }
  if (mode === "ship") {
    return (
      <g transform={turn}>
        <path
          d="M 12 0 L 6 -6 L -11 -6 L -11 6 L 6 6 Z"
          fill={color}
          stroke="#FFFFFF"
          strokeWidth={1.4}
        />
        <rect x={-6} y={-3} width={8} height={6} rx={1} fill="#FFFFFF" />
      </g>
    );
  }
  return (
    <g transform={turn}>
      <rect
        x={-10}
        y={-6}
        width={20}
        height={12}
        rx={4}
        fill={color}
        stroke="#FFFFFF"
        strokeWidth={1.4}
      />
      <rect x={2} y={-4.5} width={4} height={9} rx={1} fill="#1E2430" />
    </g>
  );
}

function Pill({
  at,
  text,
  size,
  fill,
  ink,
  anchor,
}: {
  at: XY;
  text: string;
  size: number;
  fill: string;
  ink: string;
  anchor: "left" | "middle";
}) {
  const w = text.length * size * FitText.SANS * 0.95 + size * 1.1;
  const h = size * 1.6;
  const x = anchor === "left" ? at.x : at.x - w / 2;
  return (
    <g>
      <rect x={x} y={at.y - h / 2} width={w} height={h} rx={h / 2} fill={fill} />
      <text
        x={x + w / 2}
        y={at.y + size * 0.36}
        textAnchor="middle"
        fontFamily={BOARD_FONT}
        fontWeight={800}
        fontSize={size}
        fill={ink}
      >
        {text}
      </text>
    </g>
  );
}

/** The map a scene happens on: the world's countries, the zones filled in, routes drawn with
 *  something travelling along them, and the places pinned. */
export function MapLayer({
  plan,
  t,
  palette,
}: {
  plan: MapPlan;
  t: number;
  palette: BoardPalette;
}) {
  const { area, script, places } = plan;
  const view = MapMotion.at(plan, t);
  const ink = MapInk.of(palette);
  const paths = CountryPaths.all();
  const countries = World.countries();
  const unit = Math.min(area.w, area.h);
  const label = unit * 0.03;
  const local = (p: XY) => ({
    x: view.x - area.x + p.x * view.scale,
    y: view.y - area.y + p.y * view.scale,
  });
  const placeAt = (id: string) => {
    const place = places.get(id);
    return place ? local(Projection.of(place)) : null;
  };
  const shown = (at: number | null, fade = 0.5) => (at == null ? 1 : Ease.out(t - at, fade));
  // What earlier scenes left keeps its shapes; its labels fade once this scene adds its own.
  const fresh = [...script.pins, ...script.routes, ...script.zones].some((item) => item.at != null);
  const carried = fresh ? 1 - Ease.out(t, 0.8, 0.6) : 1;
  const named = (at: number | null) => (at == null ? carried : 1);
  const pinned = script.pins.flatMap((pin) => {
    const at = placeAt(pin.id);
    return at && (pin.at == null || t >= pin.at) ? [at] : [];
  });
  return (
    <svg
      width={area.w}
      height={area.h}
      style={{
        position: "absolute",
        left: area.x,
        top: area.y,
        opacity: plan.from ? 1 : Ease.out(t, 0.5),
      }}
    >
      <defs>
        <radialGradient id="map-fade" cx="0.5" cy="0.5" r="0.62">
          <stop offset="0.72" stopColor="#fff" stopOpacity={1} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <mask id="map-mask" maskUnits="userSpaceOnUse" x={0} y={0} width={area.w} height={area.h}>
          <rect x={0} y={0} width={area.w} height={area.h} fill="url(#map-fade)" />
        </mask>
      </defs>
      <g mask="url(#map-mask)">
        <g
          transform={`matrix(${view.scale} 0 0 ${view.scale} ${view.x - area.x} ${view.y - area.y})`}
        >
          {[...paths].map(([code, d]) => (
            <path
              key={code}
              d={d}
              fill={ink.land}
              stroke={ink.border}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {script.zones.map((zone, i) => {
            const d = paths.get(zone.code);
            const fill = shown(zone.at, 0.6);
            if (!d || fill <= 0) return null;
            return (
              <path
                key={i}
                d={d}
                fill={palette[MARK_COLORS[zone.tone]]}
                fillOpacity={0.8 * fill}
                stroke={palette[MARK_COLORS[zone.tone]]}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>
        {script.routes.map((route, i) => {
          const a = places.get(route.from);
          const b = places.get(route.to);
          if (!a || !b || (route.at != null && t < route.at)) return null;
          const progress = route.at == null ? 1 : Ease.out(t - route.at, route.seconds);
          const stops = [a, ...route.via.flatMap((id) => places.get(id) ?? []), b];
          const line = stops
            .slice(1)
            .flatMap((stop, k) => GreatCircle.between(stops[k], stop, 24).slice(k ? 1 : 0))
            .map((p) => local(Projection.of(p)));
          const reach = Math.max(1, Math.round(progress * (line.length - 1)));
          const drawn = line.slice(0, reach + 1);
          const head = drawn.at(-1) as XY;
          const prev = drawn.at(-2) ?? line[0];
          const angle = Math.atan2(head.y - prev.y, head.x - prev.x);
          const moving = route.at != null && t < route.at + route.seconds + 0.4;
          const mid = line[Math.floor(line.length / 2)];
          return (
            <g key={i}>
              <polyline
                points={drawn.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={ink.line}
                strokeWidth={unit * 0.007}
                strokeDasharray={`${unit * 0.018} ${unit * 0.012}`}
                strokeLinecap="round"
              />
              {moving ? (
                <Marker
                  mode={route.mode}
                  at={head}
                  angle={angle}
                  size={unit * 0.045}
                  color={palette.accent}
                />
              ) : null}
              {route.label && progress > 0.5 ? (
                <g opacity={Ease.clamp((progress - 0.5) * 3) * named(route.at)}>
                  <Pill
                    at={{ x: mid.x, y: mid.y - label * 1.6 }}
                    text={route.label}
                    size={label}
                    fill={palette.accent}
                    ink="#101216"
                    anchor="middle"
                  />
                </g>
              ) : null}
            </g>
          );
        })}
        {script.zones.map((zone, i) => {
          const country = countries.get(zone.code);
          if (!zone.label || !country) return null;
          const middle = local(World.middle(country));
          // A pin right under the label pushes it down, clear of the pin's own name.
          const crowded = pinned.some(
            (p) => Math.hypot(p.x - middle.x, p.y - middle.y) < label * 4,
          );
          const at = crowded ? { x: middle.x, y: middle.y + label * 2.4 } : middle;
          return (
            <g
              key={i}
              opacity={shown(zone.at == null ? null : zone.at + 0.3, 0.4) * named(zone.at)}
            >
              <Pill
                at={at}
                text={zone.label}
                size={label}
                fill={palette[MARK_COLORS[zone.tone]]}
                ink="#101216"
                anchor="middle"
              />
            </g>
          );
        })}
        {script.pins.map((pin) => {
          const at = placeAt(pin.id);
          const place = places.get(pin.id);
          if (!at || !place || (pin.at != null && t < pin.at)) return null;
          const drop = pin.at == null ? 1 : Ease.pop(t - pin.at, 0.45);
          const pulse = pin.at == null ? 1 : Ease.clamp((t - pin.at) / 1.2);
          const r = unit * 0.013;
          return (
            <g key={pin.id}>
              {pulse < 1 ? (
                <circle
                  cx={at.x}
                  cy={at.y}
                  r={r * (1 + pulse * 3)}
                  fill="none"
                  stroke={palette.accent}
                  strokeWidth={2}
                  opacity={1 - pulse}
                />
              ) : null}
              <circle
                cx={at.x}
                cy={at.y}
                r={r * Math.max(0, drop)}
                fill={palette.accent}
                stroke="#FFFFFF"
                strokeWidth={r * 0.35}
              />
              <g opacity={Ease.clamp(drop) * named(pin.at)}>
                <Pill
                  at={{ x: at.x + r * 1.8, y: at.y }}
                  text={place.label}
                  size={label}
                  fill={palette.card}
                  ink={palette.cardInk}
                  anchor="left"
                />
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
