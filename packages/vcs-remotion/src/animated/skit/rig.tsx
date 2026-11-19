import type { BoardPalette } from "../shared/theme.ts";
import { PAINTS } from "../shared/theme.ts";
import { SetGlyph, SkitPictures } from "./glyph.tsx";
import {
  type CastMember,
  type Expression,
  HATS,
  HOLDS,
  type HairColour,
  type Pose,
  type Skin,
  type Wear,
} from "./spec.ts";

type Point = [number, number];

export interface PoseSpec {
  lean: number;
  tilt: number;
  front: Point;
  back: Point;
  hop: number;
  face: Expression;
  raised?: boolean;
}

export const POSE_SPECS: Record<Pose, PoseSpec> = {
  idle: { lean: 0, tilt: 0, front: [5, 34], back: [-5, 34], hop: 0, face: "neutral" },
  talk: { lean: 3, tilt: 0, front: [22, 12], back: [-6, 34], hop: 0, face: "neutral" },
  point: { lean: 5, tilt: 0, front: [37, -3], back: [-6, 34], hop: 0, face: "neutral" },
  arms_up: { lean: -3, tilt: -8, front: [14, -34], back: [-14, -34], hop: 0, face: "angry", raised: true },
  shrug: { lean: 0, tilt: 10, front: [24, -6], back: [-24, -6], hop: 0, face: "worried" },
  facepalm: { lean: 10, tilt: 14, front: [9, -14], back: [-5, 33], hop: 0, face: "tired" },
  hands_on_head: {
    lean: 0,
    tilt: -4,
    front: [9, -26],
    back: [-9, -26],
    hop: 0,
    face: "surprised",
  },
  lean_back: { lean: -12, tilt: -6, front: [-2, -20], back: [-9, -18], hop: 0, face: "smug" },
  type: { lean: 9, tilt: 6, front: [27, 17], back: [23, 19], hop: 0, face: "neutral" },
  think: { lean: 2, tilt: 8, front: [10, -10], back: [9, 16], hop: 0, face: "neutral" },
  cross_arms: { lean: -2, tilt: 0, front: [-7, 15], back: [9, 13], hop: 0, face: "smug" },
  wave: { lean: 0, tilt: -4, front: [20, -30], back: [-5, 34], hop: 0, face: "happy", raised: true },
  cheer: { lean: -2, tilt: -8, front: [12, -36], back: [-12, -36], hop: 1, face: "happy", raised: true },
  slump: { lean: 16, tilt: 18, front: [8, 36], back: [2, 36], hop: 0, face: "sad" },
  present: { lean: -2, tilt: -7, front: [31, -24], back: [-6, 33], hop: 0, face: "happy", raised: true },
};

export class PoseMix {
  static of(a: PoseSpec, b: PoseSpec, p: number): PoseSpec {
    const mix = (x: number, y: number) => x + (y - x) * p;
    const point = (x: Point, y: Point): Point => [mix(x[0], y[0]), mix(x[1], y[1])];
    return {
      lean: mix(a.lean, b.lean),
      tilt: mix(a.tilt, b.tilt),
      front: point(a.front, b.front),
      back: point(a.back, b.back),
      hop: mix(a.hop, b.hop),
      face: p < 0.5 ? a.face : b.face,
    };
  }
}

class Limb {
  static bend(root: Point, target: Point, a: number, b: number, side: number): [Point, Point] {
    const dx = target[0] - root[0];
    const dy = target[1] - root[1];
    const reach = Math.min(a + b - 0.01, Math.max(0.01, Math.hypot(dx, dy)));
    const angle = Math.atan2(dy, dx);
    const cos = (a * a + reach * reach - b * b) / (2 * a * reach);
    const spread = Math.acos(Math.min(1, Math.max(-1, cos)));
    const joint: Point = [
      root[0] + a * Math.cos(angle + side * spread),
      root[1] + a * Math.sin(angle + side * spread),
    ];
    const end: Point = [root[0] + reach * Math.cos(angle), root[1] + reach * Math.sin(angle)];
    return [joint, end];
  }

  static turn(point: Point, degrees: number, about: Point): Point {
    const r = (degrees * Math.PI) / 180;
    const x = point[0] - about[0];
    const y = point[1] - about[1];
    return [
      about[0] + x * Math.cos(r) - y * Math.sin(r),
      about[1] + x * Math.sin(r) + y * Math.cos(r),
    ];
  }
}

export class Rig {
  static readonly HEIGHT = 102;
  static readonly STROKE = 2.8;
  static readonly HEAD = 11;
  static readonly TORSO = 34;
  static readonly NECK = 15;
  static readonly UPPER = 20;
  static readonly FORE = 18;
  static readonly THIGH = 21;
  static readonly SHIN = 20;
  static readonly TALK = { lean: 2, tilt: 3, hand: 4, rise: 0.5 };
  static readonly RATE = { lean: 3.1, tilt: 4.3, hand: 5.2, hop: 3 };
  static readonly HIP_STAND: Point = [0, -40];
  static readonly HIP_SIT: Point = [-4, -24];
  static readonly WEAR_INK = { shirt: "#F1F1EC", suit: "#2B2F3A", coat: "#F4F6F8" };
  static readonly SKINS: Record<Skin, string> = {
    light: "#F4EEE6",
    fair: "#F1D9C4",
    tan: "#D9A877",
    brown: "#A86F45",
    dark: "#6B4429",
  };
  static readonly FEATURE = "#1F1B16";
  static readonly HAIR_TONES: Record<HairColour, string> = {
    black: "#1F1B16",
    brown: "#4A2F1E",
    blonde: "#C79A5B",
    red: "#7A3E22",
    grey: "#8E8C88",
    white: "#E8E6E1",
  };
  static readonly HAIR_PICKS: HairColour[] = ["brown", "black", "blonde", "red"];
  static readonly HEAD_ART = 2.7;

  static hair(member: CastMember): string {
    if (member.hair_colour) return Rig.HAIR_TONES[member.hair_colour];
    let sum = 0;
    for (const char of member.id) sum += char.charCodeAt(0);
    return Rig.HAIR_TONES[Rig.HAIR_PICKS[sum % Rig.HAIR_PICKS.length]];
  }

  static skin(member: CastMember): string {
    return Rig.SKINS[member.skin ?? "light"];
  }

  static head(pose: PoseSpec, sit: number): Point {
    const hipX = Rig.HIP_STAND[0] + (Rig.HIP_SIT[0] - Rig.HIP_STAND[0]) * sit;
    const hipY = Rig.HIP_STAND[1] + (Rig.HIP_SIT[1] - Rig.HIP_STAND[1]) * sit - pose.hop * 6;
    const rad = (pose.lean * Math.PI) / 180;
    const shoulder: Point = [hipX + Math.sin(rad) * Rig.TORSO, hipY - Math.cos(rad) * Rig.TORSO];
    return Limb.turn([shoulder[0], shoulder[1] - Rig.NECK], pose.tilt, shoulder);
  }
}

export interface FigureFrame {
  pose: PoseSpec;
  face: Expression;
  open: number;
  blink: boolean;
  sit: number;
  walk: number;
  stride: number;
  breath: number;
  talk: number;
  sway: number;
  gesture: number;
}

function Face({
  face,
  open,
  blink,
  ink,
}: {
  face: Expression;
  open: number;
  blink: boolean;
  ink: string;
}) {
  const w = 1.3;
  const eyeY = -1.5;
  const eyes: Point[] = [
    [-2.2, eyeY],
    [4.6, eyeY],
  ];
  const brows: Record<Expression, [Point, Point][]> = {
    neutral: [],
    happy: [],
    angry: [
      [
        [-4.6, -6.4],
        [-0.4, -4.6],
      ],
      [
        [2.4, -4.6],
        [6.8, -6.4],
      ],
    ],
    sad: [
      [
        [-4.4, -4.6],
        [-0.6, -6.4],
      ],
      [
        [2.6, -6.4],
        [6.6, -4.6],
      ],
    ],
    surprised: [
      [
        [-4.4, -7.4],
        [-0.4, -7.8],
      ],
      [
        [2.6, -7.8],
        [6.6, -7.4],
      ],
    ],
    smug: [
      [
        [-4.4, -5.6],
        [-0.4, -5.6],
      ],
      [
        [2.6, -7.6],
        [6.6, -6.6],
      ],
    ],
    tired: [
      [
        [-4.4, -5],
        [-0.4, -5.4],
      ],
      [
        [2.6, -5.4],
        [6.6, -5],
      ],
    ],
    worried: [
      [
        [-4.4, -5.2],
        [-0.6, -6.8],
      ],
      [
        [2.6, -6.8],
        [6.6, -5.2],
      ],
    ],
  };
  const closed = blink || face === "tired";
  const mouthY = 4.6;
  const mouths: Record<Expression, string> = {
    neutral: `M -0.6 ${mouthY} L 4.2 ${mouthY}`,
    happy: `M -1.4 ${mouthY - 0.8} Q 1.8 ${mouthY + 3} 5 ${mouthY - 0.8}`,
    angry: `M -0.8 ${mouthY + 1} Q 1.8 ${mouthY - 1.2} 4.4 ${mouthY + 1}`,
    sad: `M -1 ${mouthY + 1.4} Q 1.8 ${mouthY - 1.4} 4.6 ${mouthY + 1.4}`,
    surprised: "",
    smug: `M -0.6 ${mouthY + 0.4} Q 2.6 ${mouthY + 1.6} 5 ${mouthY - 1}`,
    tired: `M -0.4 ${mouthY + 0.6} L 4 ${mouthY + 0.2}`,
    worried: `M -1 ${mouthY + 0.6} Q 0.4 ${mouthY - 0.6} 1.8 ${mouthY + 0.6} T 4.6 ${mouthY + 0.6}`,
  };
  const talking = open > 0.05;
  return (
    <g stroke={ink} strokeWidth={w} strokeLinecap="round" fill="none">
      {eyes.map(([x, y]) =>
        closed ? (
          <line key={x} x1={x - 1.3} y1={y} x2={x + 1.3} y2={y} />
        ) : (
          <circle key={x} cx={x} cy={y} r={1.25} fill={ink} stroke="none" />
        ),
      )}
      {brows[face].map(([a, b]) => (
        <line key={`${a[0]}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
      ))}
      {talking || face === "surprised" ? (
        <ellipse
          cx={1.8}
          cy={mouthY + 0.4}
          rx={1.6 + open * 0.6}
          ry={0.7 + (talking ? open * 2.2 : 1.6)}
          fill={ink}
          stroke="none"
        />
      ) : (
        <path d={mouths[face]} />
      )}
    </g>
  );
}

function HairBack({ member, ink }: { member: CastMember; ink: string }) {
  const r = Rig.HEAD;
  switch (member.hair) {
    case "afro":
      return <circle cx={-1} cy={-3} r={r + 5} fill={ink} />;
    case "ponytail":
      return (
        <path
          d={`M ${-r + 2} ${-r + 2} Q ${-r - 9} ${-r + 1} ${-r - 7} 9 Q ${-r - 4} 3 ${-r + 1} ${-r + 5} Z`}
          fill={ink}
        />
      );
    default:
      return null;
  }
}

function HairFront({ member, ink }: { member: CastMember; ink: string }) {
  const r = Rig.HEAD;
  switch (member.hair ?? "short") {
    case "none":
    case "afro":
      return null;
    case "short":
    case "ponytail":
      return (
        <path
          d={`M ${-r} -1 Q ${-r} ${-r - 3} 0 ${-r - 2} Q ${r} ${-r - 3} ${r} -2 Q ${r * 0.4} ${-r + 2} ${-r * 0.2} ${-r + 3} Q ${-r * 0.7} ${-r + 4} ${-r} -1 Z`}
          fill={ink}
        />
      );
    case "long":
      return (
        <path
          d={`M ${-r - 1} 10 Q ${-r - 2} ${-r - 3} 0 ${-r - 2} Q ${r + 2} ${-r - 3} ${r + 1} 10 L ${r - 2} 10 Q ${r - 1} ${-r + 4} 0 ${-r + 3} Q ${-r + 1} ${-r + 4} ${-r + 2} 10 Z`}
          fill={ink}
        />
      );
    case "bun":
      return (
        <g fill={ink}>
          <circle cx={-3} cy={-r - 4} r={4.5} />
          <path
            d={`M ${-r} -1 Q ${-r} ${-r - 3} 0 ${-r - 2} Q ${r} ${-r - 3} ${r} -2 Q 0 ${-r + 1} ${-r} -1 Z`}
          />
        </g>
      );
    case "curly":
      return (
        <g fill={ink}>
          {[-9, -5, 0, 5, 9].map((x, i) => (
            <circle
              key={x}
              cx={x}
              cy={-r + 1 - (i % 2) * 1.5 - Math.cos((x / r) * 1.2) * 2}
              r={4}
            />
          ))}
        </g>
      );
    case "spiky":
      return (
        <path
          d={`M ${-r} -2 L ${-r + 1} ${-r - 4} L -5 ${-r - 1} L -2 ${-r - 6} L 1 ${-r - 1} L 5 ${-r - 6} L 6 ${-r} L ${r + 2} ${-r - 3} L ${r} -2 Q 0 ${-r + 2} ${-r} -2 Z`}
          fill={ink}
        />
      );
    case "mohawk":
      return (
        <path
          d={`M -6 ${-r + 1} L -5 ${-r - 7} L -2 ${-r - 2} L 0 ${-r - 9} L 2 ${-r - 2} L 5 ${-r - 7} L 6 ${-r + 1} Q 0 ${-r - 1} -6 ${-r + 1} Z`}
          fill={ink}
        />
      );
  }
}

function Hat({ member, ink }: { member: CastMember; ink: string }) {
  const r = Rig.HEAD;
  const paint = PAINTS[member.colour];
  const hat = SkitPictures.built(member.hat, HATS);
  const line = { stroke: ink, strokeWidth: 0.9, strokeLinejoin: "round" as const };
  if (!hat) {
    if (!member.hat) return null;
    const size = r * 2.3;
    return (
      <SetGlyph name={member.hat} x={-size / 2} y={-r - size * 0.78} size={size} color={paint} />
    );
  }
  switch (hat) {
    case "cap":
      return (
        <g {...line}>
          <path
            d={`M ${-r} -3 Q ${-r} ${-r - 4} 0 ${-r - 3} Q ${r} ${-r - 4} ${r} -3 Z`}
            fill={paint}
          />
          <path d={`M ${r - 2} -3 L ${r + 9} -2 Q ${r + 9} -4.5 ${r - 2} -5.5 Z`} fill={paint} />
        </g>
      );
    case "beanie":
      return (
        <g {...line}>
          <path
            d={`M ${-r} -3 Q ${-r} ${-r - 7} 0 ${-r - 6} Q ${r} ${-r - 7} ${r} -3 Z`}
            fill={paint}
          />
          <rect x={-r - 0.5} y={-6} width={r * 2 + 1} height={4} rx={1.5} fill={paint} />
          <circle cx={0} cy={-r - 7} r={2.6} fill={paint} />
        </g>
      );
    case "top_hat":
      return (
        <g {...line}>
          <rect x={-r + 2} y={-r - 17} width={r * 2 - 4} height={17} rx={1} fill="#1F1B16" />
          <rect x={-r + 2} y={-r - 3.5} width={r * 2 - 4} height={3} fill={paint} stroke="none" />
          <rect x={-r - 4} y={-r - 0.5} width={r * 2 + 8} height={2.6} rx={1.3} fill="#1F1B16" />
        </g>
      );
    case "chef":
      return (
        <g {...line} fill="#FAFAF7">
          <circle cx={-5} cy={-r - 7} r={5.5} />
          <circle cx={5} cy={-r - 7} r={5.5} />
          <circle cx={0} cy={-r - 10} r={6.5} />
          <rect x={-r + 1} y={-r - 4} width={r * 2 - 2} height={6} rx={1} />
        </g>
      );
    case "hard_hat":
      return (
        <g {...line}>
          <path
            d={`M ${-r - 1} ${-r + 4} Q ${-r - 1} ${-r - 9} 0 ${-r - 9} Q ${r + 1} ${-r - 9} ${r + 1} ${-r + 4} Z`}
            fill="#F2C511"
          />
          <rect x={-r - 3} y={-r + 2.5} width={r * 2 + 9} height={2.6} rx={1.2} fill="#F2C511" />
          <line x1={0} y1={-r - 9} x2={0} y2={-r + 2.5} />
        </g>
      );
    case "crown":
      return (
        <path
          {...line}
          d={`M -8 ${-r + 2} L -9 ${-r - 8} L -4 ${-r - 3} L 0 ${-r - 10} L 4 ${-r - 3} L 9 ${-r - 8} L 8 ${-r + 2} Z`}
          fill="#F2C511"
        />
      );
    case "wizard":
      return (
        <g {...line}>
          <path d={`M ${-r - 2} ${-r + 3} L 3 ${-r - 26} L ${r + 2} ${-r + 3} Z`} fill={paint} />
          <rect x={-r - 5} y={-r + 1.5} width={r * 2 + 10} height={2.6} rx={1.3} fill={paint} />
          <circle cx={1} cy={-r - 9} r={1.8} fill="#F2C511" stroke="none" />
        </g>
      );
    case "cowboy":
      return (
        <g {...line} fill="#8B5A2B">
          <path d={`M -7 ${-r + 2} Q -8 ${-r - 10} 0 ${-r - 9} Q 8 ${-r - 10} 7 ${-r + 2} Z`} />
          <path
            d={`M ${-r - 8} ${-r + 1} Q 0 ${-r + 6} ${r + 8} ${-r + 1} Q 0 ${-r - 1} ${-r - 8} ${-r + 1} Z`}
          />
        </g>
      );
    case "grad":
      return (
        <g {...line}>
          <rect x={-7} y={-r - 4} width={14} height={5} fill="#1F1B16" />
          <path
            d={`M ${-r - 6} ${-r - 4} L 0 ${-r - 8} L ${r + 6} ${-r - 4} L 0 ${-r} Z`}
            fill="#1F1B16"
          />
          <path
            d={`M 0 ${-r - 4} L ${r + 4} ${-r - 2} L ${r + 4} ${-r + 5}`}
            stroke={paint}
            strokeWidth={1.2}
            fill="none"
          />
        </g>
      );
    case "helmet":
      return (
        <g {...line}>
          <path
            d={`M ${-r - 2} 3 Q ${-r - 3} ${-r - 5} 0 ${-r - 5} Q ${r + 3} ${-r - 5} ${r + 2} 3 Z`}
            fill={paint}
          />
          <rect x={-6} y={-6} width={r + 9} height={8} rx={3} fill="#9FD3F0" opacity={0.45} />
        </g>
      );
  }
}

function Specs({ member, ink }: { member: CastMember; ink: string }) {
  switch (member.face ?? "plain") {
    case "plain":
      return null;
    case "glasses":
      return (
        <g stroke={ink} strokeWidth={0.9} fill="none">
          <circle cx={-2.2} cy={-1.5} r={2.8} />
          <circle cx={4.6} cy={-1.5} r={2.8} />
          <line x1={0.6} y1={-1.6} x2={1.8} y2={-1.6} />
        </g>
      );
    case "shades":
      return (
        <g fill="#14161C" stroke={ink} strokeWidth={0.6}>
          <rect x={-5.4} y={-3.6} width={5.6} height={3.8} rx={1.4} />
          <rect x={1.6} y={-3.6} width={5.6} height={3.8} rx={1.4} />
        </g>
      );
    case "beard":
      return (
        <path
          d={`M -8 1 Q -7 ${Rig.HEAD + 2} 1.8 ${Rig.HEAD + 2} Q 10 ${Rig.HEAD + 2} 9 1 Q 6 7.5 1.8 7.5 Q -3 7.5 -8 1 Z`}
          fill={ink}
        />
      );
    case "moustache":
      return <path d="M -1.6 3.4 Q 1.8 1.6 5.2 3.4 Q 1.8 4.4 -1.6 3.4 Z" fill={ink} />;
  }
}

class GarmentCut {
  static readonly LONG: Partial<Record<Wear, number>> = { dress: 14, lab_coat: 12, robe: 18 };
  static readonly FLARE: Partial<Record<Wear, number>> = { dress: 11, lab_coat: 8, robe: 9.5 };

  static fill(wear: Wear, paint: string): string {
    switch (wear) {
      case "shirt_tie":
      case "apron":
        return Rig.WEAR_INK.shirt;
      case "suit":
        return Rig.WEAR_INK.suit;
      case "lab_coat":
        return Rig.WEAR_INK.coat;
      default:
        return paint;
    }
  }
}

function Garment({
  member,
  hip,
  shoulder,
  ink,
}: {
  member: CastMember;
  hip: Point;
  shoulder: Point;
  ink: string;
}) {
  const wear = member.wear ?? "tee";
  const paint = PAINTS[member.colour];
  const dx = shoulder[0] - hip[0];
  const dy = shoulder[1] - hip[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const top: Point = [shoulder[0] + (dx / len) * 1.2, shoulder[1] + (dy / len) * 1.2];
  const along = (f: number, side: number): Point => [
    hip[0] + (top[0] - hip[0]) * f + nx * side,
    hip[1] + (top[1] - hip[1]) * f + ny * side,
  ];
  const below = (extra: number, side: number): Point => [
    hip[0] - (dx / len) * extra + nx * side,
    hip[1] - (dy / len) * extra + ny * side,
  ];
  const long = GarmentCut.LONG[wear] ?? 1.5;
  const flare = GarmentCut.FLARE[wear] ?? 6.2;
  const body = [along(1, 7.2), along(1, -7.2), below(long, -flare), below(long, flare)];
  const path = (points: Point[], close = true) =>
    `M ${points.map(([x, y]) => `${x} ${y}`).join(" L ")}${close ? " Z" : ""}`;
  const edge = { stroke: ink, strokeWidth: 1.1, strokeLinejoin: "round" as const };
  return (
    <g>
      {wear === "hoodie" ? (
        <path
          d={`M ${along(1, 8)[0]} ${along(1, 8)[1]} Q ${top[0] + (dx / len) * 9} ${top[1] + (dy / len) * 9} ${along(1, -8)[0]} ${along(1, -8)[1]}`}
          fill={paint}
          {...edge}
          strokeWidth={1}
        />
      ) : null}
      <path d={path(body)} fill={GarmentCut.fill(wear, paint)} {...edge} />
      {wear === "shirt_tie" || wear === "suit" ? (
        <path d={path([top, along(0.55, 1.8), along(0.2, 0), along(0.55, -1.8)])} fill={paint} />
      ) : null}
      {wear === "lab_coat" ? (
        <line
          x1={top[0]}
          y1={top[1]}
          x2={below(long, 0)[0]}
          y2={below(long, 0)[1]}
          stroke={paint}
          strokeWidth={1.2}
        />
      ) : null}
      {wear === "jacket" ? (
        <g>
          <path
            d={path([along(1, 2.2), along(1, -2.2), below(1.5, -2), below(1.5, 2)])}
            fill={Rig.WEAR_INK.shirt}
          />
          <path
            d={path([along(1, 5), along(0.5, 1.5), along(1, -5)], false)}
            fill="none"
            {...edge}
          />
        </g>
      ) : null}
      {wear === "sweater" ? (
        <g fill="none" {...edge} strokeWidth={0.8}>
          <path d={path([below(-2.5, 6.4), below(-2.5, -6.4)], false)} />
          <path
            d={`M ${along(1, 3.6)[0]} ${along(1, 3.6)[1]} Q ${along(0.86, 0)[0]} ${along(0.86, 0)[1]} ${along(1, -3.6)[0]} ${along(1, -3.6)[1]}`}
          />
        </g>
      ) : null}
      {wear === "apron" ? (
        <g>
          <path
            d={path([
              along(1, 3.4),
              along(0.72, 5.4),
              below(9, 6.6),
              below(9, -6.6),
              along(0.72, -5.4),
              along(1, -3.4),
            ])}
            fill={paint}
            {...edge}
            strokeWidth={0.9}
          />
          <path
            d={path([along(0.5, 7.4), along(0.5, -7.4)], false)}
            stroke={paint}
            strokeWidth={1.4}
          />
        </g>
      ) : null}
      {wear === "uniform" ? (
        <g>
          <path d={path([below(-3, 6.4), below(-3, -6.4)], false)} stroke={ink} strokeWidth={1.6} />
          {[0.3, 0.55, 0.8].map((f) => (
            <circle key={f} cx={along(f, 0)[0]} cy={along(f, 0)[1]} r={0.8} fill="#F2C511" />
          ))}
          <circle
            cx={along(0.75, -3.8)[0]}
            cy={along(0.75, -3.8)[1]}
            r={1.5}
            fill="#F2C511"
            stroke={ink}
            strokeWidth={0.5}
          />
        </g>
      ) : null}
      {wear === "robe" ? (
        <path
          d={path([along(1, 5), below(4, -6.5)], false)}
          stroke={ink}
          strokeWidth={1.2}
          opacity={0.5}
        />
      ) : null}
      {wear === "pyjamas" ? (
        <g fill="#FFFFFF" fillOpacity={0.6}>
          {[
            [0.78, 3.8],
            [0.46, -3.6],
            [0.18, 3.2],
          ].map(([f, side]) => (
            <circle key={f} cx={along(f, side)[0]} cy={along(f, side)[1]} r={0.9} />
          ))}
          {[0.3, 0.55, 0.8].map((f) => (
            <circle key={`button-${f}`} cx={along(f, 0)[0]} cy={along(f, 0)[1]} r={0.55} />
          ))}
        </g>
      ) : null}
      {wear === "scrubs" ? (
        <path
          d={path([along(1, 3.6), along(0.66, 0), along(1, -3.6)], false)}
          fill="none"
          {...edge}
          strokeWidth={0.9}
        />
      ) : null}
    </g>
  );
}

function Held({
  member,
  hand,
  elbow,
  mirror,
  palette,
}: {
  member: CastMember;
  hand: Point;
  elbow: Point;
  mirror: boolean;
  palette: BoardPalette;
}) {
  if (!member.holds) return null;
  const [x, y] = hand;
  const hold = SkitPictures.built(member.holds, HOLDS);
  if (!hold) {
    const size = 20;
    return (
      <SetGlyph
        name={member.holds}
        x={x - size / 2}
        y={y - size + 2}
        size={size}
        color={PAINTS[member.colour]}
        mirror={mirror}
      />
    );
  }
  switch (hold) {
    case "phone":
      return (
        <rect
          x={x - 2.2}
          y={y - 6}
          width={4.4}
          height={7.6}
          rx={1}
          fill="#14161C"
          stroke={palette.accent2}
          strokeWidth={0.8}
        />
      );
    case "coffee":
      return (
        <g>
          <rect
            x={x - 3}
            y={y - 4}
            width={6}
            height={7}
            rx={1.2}
            fill="#F4F1EA"
            stroke="#14161C"
            strokeWidth={0.6}
          />
          <path
            d={`M ${x - 1} ${y - 5.5} q 1 -2 0 -4 M ${x + 1.2} ${y - 5.5} q 1 -2 0 -4`}
            stroke={palette.muted}
            strokeWidth={0.6}
            fill="none"
          />
        </g>
      );
    case "tablet":
      return (
        <rect
          x={x - 5}
          y={y - 8}
          width={10}
          height={13}
          rx={1.4}
          fill="#14161C"
          stroke={palette.accent2}
          strokeWidth={0.8}
        />
      );
    case "book":
      return (
        <g stroke="#14161C" strokeWidth={0.6} strokeLinejoin="round">
          <rect x={x - 5.5} y={y - 8} width={11} height={9} rx={0.8} fill={PAINTS[member.colour]} />
          <line x1={x} y1={y - 8} x2={x} y2={y + 1} />
        </g>
      );
    case "pointer": {
      const dx = hand[0] - elbow[0];
      const dy = hand[1] - elbow[1];
      const len = Math.hypot(dx, dy) || 1;
      const tip: Point = [x + (dx / len) * 26, y + (dy / len) * 26];
      return (
        <g>
          <line
            x1={x}
            y1={y}
            x2={tip[0]}
            y2={tip[1]}
            stroke="#8B5A2B"
            strokeWidth={1.3}
            strokeLinecap="round"
          />
          <circle cx={tip[0]} cy={tip[1]} r={1.3} fill={palette.accent} />
        </g>
      );
    }
    case "microphone":
      return (
        <g stroke="#14161C" strokeWidth={0.6}>
          <line x1={x} y1={y + 2} x2={x + 0.8} y2={y - 4} strokeWidth={1.8} strokeLinecap="round" />
          <circle cx={x + 1} cy={y - 6} r={2.8} fill="#2B2F3A" />
        </g>
      );
  }
}

export function Chair({ ink }: { ink: string }) {
  return (
    <g stroke={ink} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.9}>
      <line x1={-16} y1={-21} x2={6} y2={-21} />
      <line x1={-15} y1={-21} x2={-17} y2={-52} />
      <line x1={-12} y1={-21} x2={-14} y2={0} />
      <line x1={3} y1={-21} x2={5} y2={0} />
    </g>
  );
}

export function DeskSet({
  member,
  sit,
  ink,
  palette,
  t,
}: {
  member: CastMember;
  sit: number;
  ink: string;
  palette: BoardPalette;
  t: number;
}) {
  const desk = member.desk ?? "none";
  if (desk === "none") return null;
  const top = sit >= 0.5 ? -30 : -42;
  const near = 14;
  const far = 58;
  const glow = 0.55 + 0.25 * Math.sin(t * 2.2);
  return (
    <g>
      <g stroke={ink} strokeWidth={2.2} strokeLinecap="round">
        <line x1={near} y1={top} x2={far} y2={top} />
        <line x1={near + 4} y1={top} x2={near + 4} y2={0} />
        <line x1={far - 4} y1={top} x2={far - 4} y2={0} />
      </g>
      {desk === "laptop" ? (
        <g strokeLinejoin="round">
          <path
            d={`M 21 ${top - 0.5} L 38 ${top - 0.5} L 36 ${top - 2.6} L 23 ${top - 2.6} Z`}
            fill="#C9D3E0"
            stroke={ink}
            strokeWidth={0.9}
          />
          <path
            d={`M 35.5 ${top - 2.2} L 38.6 ${top - 2.2} L 35.4 ${top - 21} L 32.4 ${top - 21} Z`}
            fill="#C9D3E0"
            stroke={ink}
            strokeWidth={0.9}
          />
          <circle cx={35.4} cy={top - 11.6} r={1.5} fill={palette.accent2} opacity={glow + 0.3} />
        </g>
      ) : null}
      {desk === "monitor" ? (
        <g strokeLinejoin="round">
          <line x1={37} y1={top} x2={37} y2={top - 8} stroke={ink} strokeWidth={2} />
          <path d={`M 31 ${top} L 43 ${top}`} stroke={ink} strokeWidth={2} strokeLinecap="round" />
          <rect
            x={34}
            y={top - 30}
            width={6}
            height={23}
            rx={1.2}
            fill="#2B2F3A"
            stroke={ink}
            strokeWidth={1.2}
          />
          <circle cx={37} cy={top - 18.5} r={1.3} fill={palette.accent2} opacity={glow + 0.3} />
        </g>
      ) : null}
      {desk === "papers" ? (
        <g fill={palette.card} stroke={ink} strokeWidth={0.8}>
          <rect x={30} y={top - 3} width={14} height={3} />
          <rect
            x={31}
            y={top - 5.4}
            width={14}
            height={2.4}
            transform={`rotate(-4 ${38} ${top - 4})`}
          />
        </g>
      ) : null}
    </g>
  );
}

export function StickFigure({
  member,
  frame,
  palette,
  mirror = false,
}: {
  member: CastMember;
  frame: FigureFrame;
  palette: BoardPalette;
  mirror?: boolean;
}) {
  const ink = palette.ink;
  const { pose, sit } = frame;
  const hopUp = pose.hop * 6;
  const swing = Math.sin(frame.walk) * frame.stride;
  const hip: Point = [
    Rig.HIP_STAND[0] + (Rig.HIP_SIT[0] - Rig.HIP_STAND[0]) * sit,
    Rig.HIP_STAND[1] + (Rig.HIP_SIT[1] - Rig.HIP_STAND[1]) * sit - hopUp - Math.abs(swing) * 0.6,
  ];
  const swayed = frame.talk * frame.sway;
  const lean = pose.lean + swayed * Rig.TALK.lean * Math.sin(frame.breath * Rig.RATE.lean);
  const rad = (lean * Math.PI) / 180;
  const shoulder: Point = [
    hip[0] + Math.sin(rad) * Rig.TORSO,
    hip[1] - Math.cos(rad) * Rig.TORSO + Math.sin(frame.breath) * Rig.TALK.rise * frame.sway,
  ];
  const tilt = pose.tilt + swayed * Rig.TALK.tilt * Math.sin(frame.breath * Rig.RATE.tilt);
  const head = Limb.turn([shoulder[0], shoulder[1] - Rig.NECK], tilt, shoulder);
  const arm: Point = [shoulder[0], shoulder[1] + 2.5];
  const gestureY =
    frame.talk * frame.gesture * Rig.TALK.hand * Math.sin(frame.breath * Rig.RATE.hand);
  const swingArm = frame.stride > 0 ? -swing * 0.6 : 0;
  const frontTarget: Point = [arm[0] + pose.front[0] + swingArm, arm[1] + pose.front[1] + gestureY];
  const hold = SkitPictures.built(member.holds, HOLDS);
  const forward = hold === "pointer" || hold === "microphone";
  const holdsBack = Boolean(member.holds) && !forward;
  const backTarget: Point = holdsBack
    ? sit > 0.3
      ? [arm[0] + 16, arm[1] + 17]
      : [arm[0] + 18, arm[1] + 14]
    : [
        arm[0] + pose.back[0] - swingArm,
        arm[1] + pose.back[1],
      ];
  const [frontElbow, frontHand] = Limb.bend(arm, frontTarget, Rig.UPPER, Rig.FORE, 1);
  const [backElbow, backHand] = Limb.bend(arm, backTarget, Rig.UPPER, Rig.FORE, -1);
  const standFeet: [Point, Point] = [
    [5 + swing, 0 - Math.max(0, Math.sin(frame.walk)) * 3 * (frame.stride > 0 ? 1 : 0)],
    [-5 - swing, 0 - Math.max(0, -Math.sin(frame.walk)) * 3 * (frame.stride > 0 ? 1 : 0)],
  ];
  const sitFeet: [Point, Point] = [
    [20, 0],
    [15, 0],
  ];
  const foot = (i: 0 | 1): Point => [
    standFeet[i][0] + (sitFeet[i][0] - standFeet[i][0]) * sit,
    standFeet[i][1] + (sitFeet[i][1] - standFeet[i][1]) * sit,
  ];
  const [frontKnee, frontFoot] = Limb.bend(hip, foot(0), Rig.THIGH, Rig.SHIN, -1);
  const [backKnee, backFoot] = Limb.bend(hip, foot(1), Rig.THIGH, Rig.SHIN, -1);
  const line = (points: Point[], width = Rig.STROKE, color = ink) => (
    <polyline
      points={points.map(([x, y]) => `${x},${y}`).join(" ")}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
  const art = Rig.HEAD * Rig.HEAD_ART;
  const held = forward ? (
    <Held member={member} hand={frontHand} elbow={frontElbow} mirror={mirror} palette={palette} />
  ) : (
    <Held member={member} hand={backHand} elbow={backElbow} mirror={mirror} palette={palette} />
  );
  return (
    <g>
      {line([hip, backKnee, backFoot], Rig.STROKE * 0.92)}
      {holdsBack ? null : line([arm, backElbow, backHand], Rig.STROKE * 0.92)}
      {line([hip, frontKnee, frontFoot])}
      {line([hip, shoulder])}
      <Garment member={member} hip={hip} shoulder={shoulder} ink={ink} />
      <g transform={`translate(${head[0]} ${head[1]}) rotate(${tilt})`}>
        {member.head ? (
          <SetGlyph
            name={member.head}
            x={-art / 2}
            y={-art / 2}
            size={art}
            color={ink}
            mirror={mirror}
          />
        ) : (
          <>
            <g stroke={ink} strokeWidth={0.8} strokeLinejoin="round">
              <HairBack member={member} ink={Rig.hair(member)} />
            </g>
            <circle r={Rig.HEAD} fill={Rig.skin(member)} stroke={ink} strokeWidth={Rig.STROKE} />
            <g stroke={ink} strokeWidth={0.8} strokeLinejoin="round">
              <HairFront member={member} ink={Rig.hair(member)} />
            </g>
            <Face face={frame.face} open={frame.open} blink={frame.blink} ink={Rig.FEATURE} />
            <Specs member={member} ink={Rig.FEATURE} />
          </>
        )}
        <Hat member={member} ink={ink} />
      </g>
      {holdsBack ? line([arm, backElbow, backHand], Rig.STROKE * 0.92) : null}
      {line([arm, frontElbow, frontHand])}
      {held}
    </g>
  );
}
