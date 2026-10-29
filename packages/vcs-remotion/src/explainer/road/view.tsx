import { Ease } from "../pieces/ease.ts";
import { BOARD_FONT, type BoardPalette } from "../theme.ts";
import { type Box, FitText } from "../timeline.ts";
import { CAR_SIZE, CarKinds, type Point, type Pose, RoadMap } from "./geometry.ts";
import type { RoadPlan } from "./scene.ts";
import type { LightState, RoadArm, RoadCar, RoadLook } from "./spec.ts";
import { CarPose, type Era, type Measure, RoadScript } from "./state.ts";

/** The road's own colours on a theme: dark asphalt on light boards, chalk-like on dark ones.
 *  The asphalt is drawn solid and faded as one, so where shapes overlap it stays even. */
class RoadInk {
  static of(palette: BoardPalette) {
    return palette.light
      ? {
          asphalt: "#5C5955",
          tar: 1,
          paint: "#F7F4EC",
          island: `${palette.good}8C`,
          person: palette.accent2,
        }
      : {
          asphalt: palette.ink,
          tar: 0.13,
          paint: `${palette.ink}D9`,
          island: `${palette.good}4D`,
          person: palette.warn,
        };
  }

  static car(car: RoadCar, palette: BoardPalette): string {
    switch (car) {
      case "you":
        return palette.accent;
      case "car-1":
        return palette.accent2;
      case "car-2":
        return "#A3A8AF";
      case "car-3":
        return "#6B7280";
      case "truck":
        return "#E4DFD3";
      case "bike":
        return palette.good;
    }
  }
}

const LOOK_TURNS: Record<RoadLook, number> = {
  ahead: 0,
  right: Math.PI / 2,
  left: -Math.PI / 2,
  behind: Math.PI,
  "right-shoulder": (Math.PI * 3) / 4,
  "left-shoulder": (-Math.PI * 3) / 4,
};

const deg = (angle: number) => (angle * 180) / Math.PI;

type Ink = ReturnType<typeof RoadInk.of>;

function Stripe({
  a,
  b,
  ink,
  width,
  dash,
  roll = 0,
  faint,
}: {
  a: Point;
  b: Point;
  ink: Ink;
  width: number;
  dash?: string;
  roll?: number;
  faint?: boolean;
}) {
  return (
    <line
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      stroke={ink.paint}
      strokeOpacity={faint ? 0.55 : 1}
      strokeWidth={width}
      strokeDasharray={dash}
      strokeDashoffset={roll}
    />
  );
}

const LINE = 0.007;
const DASH = "0.04 0.04";

const PARKED_CARS: RoadCar[] = ["car-2", "car-3"];

/** A road along the screen (straight, motorway, car park), its lines drawn top to bottom:
 *  they roll toward the viewer, so cars that hold in view read as driving on, until cars
 *  park at the kerb and the road stands still. */
function Linear({
  era,
  ink,
  t,
  palette,
}: {
  era: Era;
  ink: Ink;
  t: number;
  palette: BoardPalette;
}) {
  const map = era.map;
  const far = map.extent.y + 0.4;
  const half = map.half;
  const middle = map.middle;
  const still = map.layout === "car-park" || era.kerb === null;
  const ran = era.kerb == null ? t : Math.min(t, era.kerb);
  const roll = still ? 0 : -((ran * RoadScript.SPEED) % 0.08);
  const at = (x: number): [Point, Point] => [
    { x, y: -far },
    { x, y: far },
  ];
  const lanes = Array.from({ length: map.lanes - 1 }, (_, k) => middle + (k + 1) * RoadMap.LANE);
  const kerb = era.kerb === undefined ? 0 : era.kerb === null ? 1 : Ease.out(t - era.kerb, 0.5);
  const { deep, wide } = RoadMap.BAY;
  const parked = map.layout === "car-park" ? map.parked() : kerb > 0 ? map.parked() : [];
  return (
    <g>
      <g opacity={ink.tar}>
        <rect x={-half} y={-far} width={half * 2} height={far * 2} fill={ink.asphalt} />
        {map.layout === "motorway" ? (
          <path
            d={`M ${map
              .slip()
              .map((p) => `${p.x} ${p.y}`)
              .join(" L ")}`}
            fill="none"
            stroke={ink.asphalt}
            strokeWidth={RoadMap.LANE}
          />
        ) : null}
        {map.layout === "car-park"
          ? [-1, 1].map((side) => (
              <rect
                key={side}
                x={side > 0 ? half : -half - deep}
                y={-far}
                width={deep}
                height={far * 2}
                fill={ink.asphalt}
              />
            ))
          : null}
        {kerb > 0 ? (
          <rect
            x={half}
            y={-far}
            width={RoadMap.STRIP}
            height={far * 2}
            fill={ink.asphalt}
            opacity={kerb}
          />
        ) : null}
      </g>
      {map.layout === "motorway" ? (
        <>
          <rect x={-middle} y={-far} width={middle * 2} height={far * 2} fill={ink.island} />
          <Stripe
            a={{ x: half, y: RoadMap.SLIP[0] }}
            b={{ x: half, y: RoadMap.SLIP[1] }}
            ink={ink}
            width={LINE * 0.8}
            dash={DASH}
          />
        </>
      ) : null}
      {map.layout === "car-park" ? (
        map.bays().map((bay, k) => {
          const x0 = bay.side > 0 ? half : -half - deep;
          return (
            <Stripe
              key={k}
              a={{ x: x0, y: bay.y - wide / 2 }}
              b={{ x: x0 + deep, y: bay.y - wide / 2 }}
              ink={ink}
              width={LINE * 0.8}
            />
          );
        })
      ) : map.layout === "motorway" ? (
        [-1, 1].map((side) => (
          <Stripe
            key={side}
            a={at(side * (middle + 0.01))[0]}
            b={at(side * (middle + 0.01))[1]}
            ink={ink}
            width={LINE}
          />
        ))
      ) : map.lanes > 1 ? (
        <Stripe a={at(0)[0]} b={at(0)[1]} ink={ink} width={LINE * 1.4} />
      ) : (
        <Stripe a={at(0)[0]} b={at(0)[1]} ink={ink} width={LINE} dash={DASH} roll={roll} />
      )}
      {lanes.flatMap((x) =>
        [x, -x].map((side) => (
          <Stripe
            key={side}
            a={at(side)[0]}
            b={at(side)[1]}
            ink={ink}
            width={LINE * 0.8}
            dash={DASH}
            roll={roll}
          />
        )),
      )}
      {map.layout === "car-park"
        ? null
        : [-1, 1].map((side) => (
            <Stripe
              key={side}
              a={at(side * (half - 0.012))[0]}
              b={at(side * (half - 0.012))[1]}
              ink={ink}
              width={LINE * 0.6}
              faint
            />
          ))}
      <g opacity={map.layout === "car-park" ? 1 : kerb}>
        {parked.map((pose, k) => (
          <CarShape key={k} car={PARKED_CARS[k % 2]} pose={pose} palette={palette} blink={null} />
        ))}
      </g>
    </g>
  );
}

/** A junction or a roundabout: its arms, the middle where they meet, and a give-way line
 *  across each lane coming in. */
function Junction({ map, ink, lit }: { map: RoadMap; ink: Ink; lit: ReadonlySet<RoadArm> }) {
  const far = Math.max(map.extent.x, map.extent.y) + 0.4;
  const c = map.center;
  const half = map.half;
  return (
    <g>
      <g opacity={ink.tar}>
        {map.arms.map((arm) => {
          const dir = map.dir(arm);
          const w = dir.x ? far : half;
          const h = dir.x ? half : far;
          return (
            <rect
              key={arm}
              x={c.x + (dir.x < 0 ? -far : dir.x > 0 ? 0 : -half)}
              y={c.y + (dir.y < 0 ? -far : dir.y > 0 ? 0 : -half)}
              width={dir.x ? w : w * 2}
              height={dir.y ? h : h * 2}
              fill={ink.asphalt}
            />
          );
        })}
        {map.layout === "roundabout" ? (
          <circle cx={c.x} cy={c.y} r={RoadMap.RING + RoadMap.RING_HALF} fill={ink.asphalt} />
        ) : (
          <rect
            x={c.x - half}
            y={c.y - half}
            width={half * 2}
            height={half * 2}
            fill={ink.asphalt}
          />
        )}
      </g>
      {map.layout === "roundabout" ? (
        <circle
          cx={c.x}
          cy={c.y}
          r={RoadMap.RING - RoadMap.RING_HALF}
          fill={ink.island}
          stroke={ink.paint}
          strokeWidth={LINE}
        />
      ) : null}
      {map.arms.map((arm) => {
        const dir = map.dir(arm);
        const across = { x: dir.y, y: -dir.x };
        const at = (s: number, k: number) => ({
          x: c.x + dir.x * s + across.x * k,
          y: c.y + dir.y * s + across.y * k,
        });
        return (
          <g key={arm}>
            <Stripe a={at(map.box, 0)} b={at(far, 0)} ink={ink} width={LINE} dash={DASH} />
            {[-1, 1].map((side) => (
              <Stripe
                key={side}
                a={at(map.box, side * (half - 0.012))}
                b={at(far, side * (half - 0.012))}
                ink={ink}
                width={LINE * 0.6}
                faint
              />
            ))}
            {/* A light's arm stops at a solid line; the others give way at a dashed one. */}
            <Stripe
              a={at(map.box + 0.006, 0.004)}
              b={at(map.box + 0.006, half - 0.012)}
              ink={ink}
              width={0.012}
              dash={lit.has(arm) ? undefined : "0.018 0.012"}
            />
          </g>
        );
      })}
    </g>
  );
}

function Surface({
  era,
  ink,
  t,
  palette,
  lit,
}: {
  era: Era;
  ink: Ink;
  t: number;
  palette: BoardPalette;
  lit: ReadonlySet<RoadArm>;
}) {
  const map = era.map;
  return (
    <g>
      {map.linear ? (
        <Linear era={era} ink={ink} t={t} palette={palette} />
      ) : (
        <Junction map={map} ink={ink} lit={lit} />
      )}
      {[...era.zebras].map(([arm, since]) => (
        <Zebra
          key={arm}
          map={map}
          arm={arm}
          ink={ink}
          shown={since == null ? 1 : Ease.out(t - since, 0.5)}
        />
      ))}
    </g>
  );
}

function Zebra({ map, arm, ink, shown }: { map: RoadMap; arm: RoadArm; ink: Ink; shown: number }) {
  if (shown <= 0) return null;
  const [a, b] = map.crossing(arm);
  const dir = map.dir(arm);
  const count = Math.max(3, Math.round((map.half * 2) / 0.04));
  return (
    <g opacity={shown}>
      {Array.from({ length: count }, (_, k) => {
        const f = (k + 0.5) / count;
        const x = a.x + (b.x - a.x) * f;
        const y = a.y + (b.y - a.y) * f;
        const w = dir.x ? 0.07 : 0.022;
        const h = dir.x ? 0.022 : 0.07;
        return <rect key={k} x={x - w / 2} y={y - h / 2} width={w} height={h} fill={ink.paint} />;
      })}
    </g>
  );
}

function CarShape({
  car,
  pose,
  palette,
  blink,
}: {
  car: RoadCar;
  pose: Pose;
  palette: BoardPalette;
  blink: "left" | "right" | null;
}) {
  const kind = CarKinds.of(car);
  const { long, wide } = CAR_SIZE[kind];
  const color = RoadInk.car(car, palette);
  const glass = "#1E2430";
  const lamp = palette.warn;
  const body =
    kind === "bike" ? (
      <>
        <rect x={-0.004} y={-long / 2} width={0.008} height={long} rx={0.004} fill="#2B2B2B" />
        <ellipse cx={0} cy={0.004} rx={wide / 2} ry={0.012} fill={color} />
        <circle cx={0} cy={-0.004} r={0.009} fill="#F1F1F1" stroke="#2B2B2B" strokeWidth={0.002} />
      </>
    ) : kind === "truck" ? (
      <>
        <rect
          x={-wide / 2}
          y={-long / 2}
          width={wide}
          height={long * 0.26}
          rx={0.012}
          fill={palette.accent2}
        />
        <rect
          x={-wide / 2 + 0.008}
          y={-long / 2 + 0.012}
          width={wide - 0.016}
          height={long * 0.08}
          rx={0.004}
          fill={glass}
        />
        <rect
          x={-wide / 2}
          y={-long / 2 + long * 0.29}
          width={wide}
          height={long * 0.71}
          rx={0.008}
          fill={color}
          stroke="#00000030"
          strokeWidth={0.003}
        />
      </>
    ) : (
      <>
        <rect x={-wide / 2} y={-long / 2} width={wide} height={long} rx={wide * 0.3} fill={color} />
        <rect
          x={-wide / 2 + 0.007}
          y={-long / 2 + long * 0.22}
          width={wide - 0.014}
          height={long * 0.16}
          rx={0.008}
          fill={glass}
        />
        <rect
          x={-wide / 2 + 0.008}
          y={long / 2 - long * 0.24}
          width={wide - 0.016}
          height={long * 0.1}
          rx={0.006}
          fill={glass}
        />
        <rect
          x={-wide / 2 + 0.009}
          y={-long / 2 + long * 0.4}
          width={wide - 0.018}
          height={long * 0.32}
          rx={0.01}
          fill="#FFFFFF"
          opacity={0.16}
        />
        {[-1, 1].map((side) => (
          <circle
            key={side}
            cx={side * wide * 0.3}
            cy={-long / 2 + 0.006}
            r={0.0055}
            fill="#FFF4C8"
          />
        ))}
      </>
    );
  const lamps = blink
    ? [-long / 2 + 0.008, long / 2 - 0.008].map((y) => {
        const x = (blink === "right" ? 1 : -1) * (wide / 2 - 0.004);
        return (
          <g key={y}>
            <circle cx={x} cy={y} r={0.02} fill={lamp} opacity={0.35} />
            <circle cx={x} cy={y} r={0.008} fill={lamp} />
          </g>
        );
      })
    : null;
  return (
    <g transform={`translate(${pose.x} ${pose.y}) rotate(${deg(pose.angle) + 90})`}>
      <rect
        x={-wide / 2 + 0.004}
        y={-long / 2 + 0.008}
        width={wide}
        height={long}
        rx={wide * 0.3}
        fill="#000000"
        opacity={0.22}
      />
      {body}
      {lamps}
    </g>
  );
}

function Cone({
  id,
  pose,
  toward,
  shown,
  color,
}: {
  id: string;
  pose: Pose;
  toward: RoadLook;
  shown: number;
  color: string;
}) {
  const angle = pose.angle + LOOK_TURNS[toward];
  const reach = 0.36 * shown;
  const spread = toward === "behind" ? 0.32 : 0.48;
  const tip = (turn: number) => ({
    x: pose.x + Math.cos(angle + turn) * reach,
    y: pose.y + Math.sin(angle + turn) * reach,
  });
  const a = tip(-spread);
  const b = tip(spread);
  return (
    <g opacity={shown}>
      <defs>
        <radialGradient id={id} cx={pose.x} cy={pose.y} r={reach} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={color} stopOpacity={0.55} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <path
        d={`M ${pose.x} ${pose.y} L ${a.x} ${a.y} A ${reach} ${reach} 0 0 1 ${b.x} ${b.y} Z`}
        fill={`url(#${id})`}
      />
    </g>
  );
}

/** A distance laid on the lane ahead of a car, in parts, up to the next car or the edge. */
class Reach {
  static ahead(script: RoadScript, map: RoadMap, car: RoadCar, pose: Pose, t: number): number {
    const dir = { x: Math.cos(pose.angle), y: Math.sin(pose.angle) };
    const { long } = CAR_SIZE[CarKinds.of(car)];
    let best = Number.POSITIVE_INFINITY;
    for (const track of script.tracks) {
      if (track.car === car) continue;
      const other = CarPose.at(track, t);
      if (!other) continue;
      const dx = other.pose.x - pose.x;
      const dy = other.pose.y - pose.y;
      const along = dx * dir.x + dy * dir.y;
      const across = Math.abs(-dx * dir.y + dy * dir.x);
      if (along <= 0 || across > RoadMap.LANE * 0.6) continue;
      best = Math.min(best, along - CAR_SIZE[CarKinds.of(track.car)].long / 2 - long / 2 - 0.02);
    }
    const toEdge = (limit: number, p: number, d: number) =>
      d > 1e-6 ? (limit - p) / d : d < -1e-6 ? (-limit - p) / d : Number.POSITIVE_INFINITY;
    const edge = Math.min(toEdge(map.extent.x, pose.x, dir.x), toEdge(map.extent.y, pose.y, dir.y));
    return Math.max(0.05, Math.min(best, edge - long / 2 - 0.06));
  }
}

const PART_TONES = ["accent2", "warn", "bad"] as const;

function MeasureMarks({
  measure,
  pose,
  length,
  t,
  palette,
  ink,
}: {
  measure: Measure;
  pose: Pose;
  length: number;
  t: number;
  palette: BoardPalette;
  ink: Ink;
}) {
  const { long, wide } = CAR_SIZE[CarKinds.of(measure.car)];
  const total = measure.parts.reduce((sum, part) => sum + part.value, 0);
  let from = long / 2 + 0.012;
  return (
    <g transform={`translate(${pose.x} ${pose.y}) rotate(${deg(pose.angle) + 90})`}>
      {measure.parts.map((part, k) => {
        const size = (length * part.value) / total;
        const grow = Ease.out(t - measure.at - 0.2 - k * 0.75, 0.7);
        const y0 = -from;
        from += size;
        if (grow <= 0) return null;
        const color = palette[PART_TONES[k]];
        return (
          <g key={k}>
            <rect
              x={-wide * 0.62}
              y={y0 - size * grow}
              width={wide * 1.24}
              height={size * grow}
              fill={color}
              opacity={0.5}
            />
            <line
              x1={-wide * 0.75}
              x2={wide * 0.75}
              y1={y0 - size * grow}
              y2={y0 - size * grow}
              stroke={ink.paint}
              strokeWidth={0.006}
            />
          </g>
        );
      })}
    </g>
  );
}

const LAMPS: { state: LightState; color: string }[] = [
  { state: "red", color: "#FF3B30" },
  { state: "amber", color: "#FFB020" },
  { state: "green", color: "#2FD06A" },
];

/** A traffic light's head, upright on screen beside the stop line, its lit lamp glowing. */
function LightHead({
  at,
  size,
  state,
  shown,
}: {
  at: Point;
  size: number;
  state: LightState;
  shown: number;
}) {
  const w = size * 0.36;
  const h = size;
  const r = w * 0.32;
  return (
    <g opacity={shown}>
      <rect x={at.x - w * 0.12} y={at.y + h / 2} width={w * 0.24} height={h * 0.5} fill="#2A2C31" />
      <rect
        x={at.x - w / 2}
        y={at.y - h / 2}
        width={w}
        height={h}
        rx={w * 0.25}
        fill="#1B1D22"
        stroke="#00000055"
      />
      {LAMPS.map((lamp, k) => {
        const cy = at.y - h / 2 + (h * (k + 0.5)) / 3;
        const on = lamp.state === state;
        return (
          <g key={lamp.state}>
            {on ? <circle cx={at.x} cy={cy} r={r * 2} fill={lamp.color} opacity={0.3} /> : null}
            <circle cx={at.x} cy={cy} r={r} fill={on ? lamp.color : "#3A3D44"} />
          </g>
        );
      })}
    </g>
  );
}

function Tag({
  at,
  text,
  size,
  color,
  toward,
}: {
  at: Point;
  text: string;
  size: number;
  color: string;
  toward: number;
}) {
  const w = text.length * size * FitText.SANS * 0.95 + size * 1.1;
  const h = size * 1.6;
  const x = toward < 0 ? at.x - w : toward > 0 ? at.x : at.x - w / 2;
  return (
    <g>
      <rect x={x} y={at.y - h / 2} width={w} height={h} rx={h / 2} fill={color} />
      <text
        x={x + w / 2}
        y={at.y + size * 0.36}
        textAnchor="middle"
        fontFamily={BOARD_FONT}
        fontWeight={800}
        fontSize={size}
        fill="#101216"
      >
        {text}
      </text>
    </g>
  );
}

class RoadMotion {
  static box(plan: RoadPlan, t: number): { box: Box; opacity: number } {
    if (!plan.from) return { box: plan.area, opacity: Ease.out(t, 0.45) };
    const p = Ease.out(t, 0.8);
    const mix = (a: number, b: number) => a + (b - a) * p;
    const a = plan.from;
    const b = plan.area;
    return {
      box: { x: mix(a.x, b.x), y: mix(a.y, b.y), w: mix(a.w, b.w), h: mix(a.h, b.h) },
      opacity: 1,
    };
  }
}

/** The road a driving lesson happens on, seen from above: its layout, the cars on it with
 *  their indicators, where the driver looks, distances on the lane and people crossing. */
export function RoadView({
  plan,
  t,
  palette,
}: {
  plan: RoadPlan;
  t: number;
  palette: BoardPalette;
}) {
  const { box, opacity } = RoadMotion.box(plan, t);
  const script = plan.script;
  const ink = RoadInk.of(palette);
  const unit = Math.min(box.w, box.h);
  const mirror = plan.side === "left" ? -1 : 1;
  const view = (p: Point) => {
    const x = p.x * mirror;
    const [across, down] = plan.turned ? [-p.y, x] : [x, p.y];
    return { x: box.w / 2 + across * unit, y: box.h / 2 + down * unit };
  };
  const eras = script.eras;
  let now = 0;
  for (let i = 0; i < eras.length; i++) if ((eras[i].at ?? 0) <= t) now = i;
  const map = eras[now].map;
  const cars = script.tracks
    .map((track) => ({ track, place: CarPose.at(track, t) }))
    .filter((entry) => entry.place != null);
  const poseOf = (car: RoadCar) => cars.find((entry) => entry.track.car === car)?.place?.pose;
  const blinkOn = Math.floor(t * 2.6) % 2 === 0;
  const label = unit * 0.032;
  const tags: { at: Point; text: string; color: string; toward: number }[] = [];
  for (const { track, place } of cars) {
    const move = track.moves.filter((m) => m.at <= t).at(-1);
    if (move?.label && t < move.at + move.seconds + 1.2 && place) {
      const p = view(place.pose);
      tags.push({
        at: { x: p.x, y: p.y - unit * 0.1 },
        text: move.label,
        color: RoadInk.car(track.car, palette),
        toward: 0,
      });
    }
  }
  return (
    <svg
      width={box.w}
      height={box.h}
      style={{ position: "absolute", left: box.x, top: box.y, overflow: "visible", opacity }}
    >
      <defs>
        <linearGradient id="road-fade-x" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity={0} />
          <stop offset="0.1" stopColor="#fff" stopOpacity={1} />
          <stop offset="0.9" stopColor="#fff" stopOpacity={1} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="road-fade-y" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0} />
          <stop offset="0.1" stopColor="#fff" stopOpacity={1} />
          <stop offset="0.9" stopColor="#fff" stopOpacity={1} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <mask id="road-mask-x" maskUnits="userSpaceOnUse" x={0} y={0} width={box.w} height={box.h}>
          <rect x={0} y={0} width={box.w} height={box.h} fill="url(#road-fade-x)" />
        </mask>
        <mask id="road-mask-y" maskUnits="userSpaceOnUse" x={0} y={0} width={box.w} height={box.h}>
          <rect x={0} y={0} width={box.w} height={box.h} fill="url(#road-fade-y)" />
        </mask>
      </defs>
      <g mask="url(#road-mask-x)">
        <g mask="url(#road-mask-y)">
          <g
            transform={`translate(${box.w / 2} ${box.h / 2}) rotate(${plan.turned ? 90 : 0}) scale(${unit * mirror} ${unit})`}
          >
            {eras.map((era, i) => {
              const next = eras[i + 1]?.at;
              const shown =
                (era.at == null ? 1 : Ease.out(t - era.at, 0.45)) *
                (next == null ? 1 : 1 - Ease.out(t - next, 0.35));
              return shown > 0 ? (
                <g key={i} opacity={shown}>
                  <Surface
                    era={era}
                    ink={ink}
                    t={t}
                    palette={palette}
                    lit={new Set(script.lights.filter((l) => l.era === i).map((l) => l.arm))}
                  />
                </g>
              ) : null;
            })}
            {script.measures.map((measure, i) => {
              if (t < measure.at || t >= measure.until) return null;
              const pose = poseOf(measure.car);
              if (!pose) return null;
              const length = Reach.ahead(script, map, measure.car, pose, t);
              return (
                <MeasureMarks
                  key={i}
                  measure={measure}
                  pose={pose}
                  length={length}
                  t={t}
                  palette={palette}
                  ink={ink}
                />
              );
            })}
            {script.looks.map((look, i) => {
              if (t < look.at || t >= look.until) return null;
              const pose = poseOf(look.car);
              if (!pose) return null;
              const shown =
                Ease.out(t - look.at, 0.4) * (1 - Ease.out(t - (look.until - 0.3), 0.3));
              return (
                <Cone
                  key={i}
                  id={`road-look-${i}`}
                  pose={pose}
                  toward={look.toward}
                  shown={shown}
                  color={palette.accent2}
                />
              );
            })}
            {script.walks.map((walk, i) => {
              const u = (t - walk.at) / walk.seconds;
              if (u < 0 || u > 1) return null;
              const [a, b] = map.has(walk.arm) ? map.crossing(walk.arm) : [null, null];
              if (!a || !b) return null;
              const k = Ease.clamp(u);
              const x = a.x + (b.x - a.x) * k;
              const y = a.y + (b.y - a.y) * k;
              const step = Math.sin(t * 14) * 0.004;
              const angle = Math.atan2(b.y - a.y, b.x - a.x);
              return (
                <g
                  key={i}
                  transform={`translate(${x} ${y}) rotate(${deg(angle) + 90})`}
                  opacity={Math.min(1, u * 6, (1 - u) * 6)}
                >
                  <ellipse cx={0} cy={step} rx={0.03} ry={0.016} fill={ink.person} />
                  <circle
                    cx={0}
                    cy={-0.001}
                    r={0.014}
                    fill="#E9BC8E"
                    stroke="#00000040"
                    strokeWidth={0.002}
                  />
                </g>
              );
            })}
            {cars.map(({ track, place }) => {
              const signal = script.signals.find(
                (s) => s.car === track.car && t >= s.at && t < s.until,
              );
              return (
                <CarShape
                  key={track.car + (track.until ?? "")}
                  car={track.car}
                  pose={place?.pose as Pose}
                  palette={palette}
                  blink={signal && blinkOn ? signal.side : null}
                />
              );
            })}
          </g>
        </g>
      </g>
      {script.measures.map((measure, i) => {
        if (t < measure.at || t >= measure.until) return null;
        const pose = poseOf(measure.car);
        if (!pose) return null;
        const length = Reach.ahead(script, map, measure.car, pose, t);
        const total = measure.parts.reduce((sum, part) => sum + part.value, 0);
        const dir = { x: Math.cos(pose.angle), y: Math.sin(pose.angle) };
        // Labels stand on the kerb side, clear of oncoming traffic.
        const kerb = { x: -dir.y, y: dir.x };
        const { long, wide } = CAR_SIZE[CarKinds.of(measure.car)];
        let from = long / 2 + 0.012;
        return measure.parts.map((part, k) => {
          const size = (length * part.value) / total;
          const mid = from + size / 2;
          from += size;
          const shown = Ease.out(t - measure.at - 0.5 - k * 0.75, 0.4);
          if (shown <= 0) return null;
          const spot = {
            x: pose.x + dir.x * mid + kerb.x * (wide * 0.75 + 0.02),
            y: pose.y + dir.y * mid + kerb.y * (wide * 0.75 + 0.02),
          };
          const at = view(spot);
          const dx = view(spot).x - view(pose).x;
          const toward = Math.abs(dx) < 1 ? 0 : Math.sign(dx);
          const value = `${part.value}${measure.unit ? ` ${measure.unit}` : ""}`;
          return (
            <g key={`${i}-${k}`} opacity={shown}>
              <Tag
                at={at}
                text={`${part.label} · ${value}`}
                size={label}
                color={palette[PART_TONES[k]]}
                toward={toward}
              />
            </g>
          );
        });
      })}
      {script.looks.map((look, i) => {
        if (!look.label || t < look.at || t >= look.until) return null;
        const pose = poseOf(look.car);
        if (!pose) return null;
        const angle = pose.angle + LOOK_TURNS[look.toward];
        const at = view({ x: pose.x + Math.cos(angle) * 0.3, y: pose.y + Math.sin(angle) * 0.3 });
        return (
          <g key={i} opacity={Ease.out(t - look.at - 0.2, 0.3)}>
            <Tag at={at} text={look.label} size={label} color={palette.accent2} toward={0} />
          </g>
        );
      })}
      {[...new Set(script.lights.filter((l) => l.era === now).map((l) => l.arm))].map((arm) => {
        const shown = script.lights.filter((l) => l.era === now && l.arm === arm && l.at <= t);
        const light = shown.at(-1);
        if (!light) return null;
        const dir = map.dir(arm);
        const along = map.box + 0.035;
        const out = map.half + 0.05;
        const spot = view({
          x: map.center.x + dir.x * along + dir.y * out,
          y: map.center.y + dir.y * along - dir.x * out,
        });
        const first = shown[0].at;
        return (
          <LightHead
            key={arm}
            at={spot}
            size={unit * 0.085}
            state={light.state}
            shown={Ease.out(t - first, 0.35)}
          />
        );
      })}
      {tags.map((tag, i) => (
        <Tag
          key={i}
          at={tag.at}
          text={tag.text}
          size={label}
          color={tag.color}
          toward={tag.toward}
        />
      ))}
    </svg>
  );
}
