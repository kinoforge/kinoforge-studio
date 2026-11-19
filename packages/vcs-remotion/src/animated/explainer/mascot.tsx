import type { ReactNode } from "react";
import type { MascotHat, MascotRig, Mood } from "./spec.ts";
import type { BoardPalette } from "../shared/theme.ts";

/** A mascot's pose at one frame, worked out by the scene from the voice and the beats. */
export interface MascotPose {
  mood: Mood;
  /** Mouth opening, 0 shut to 1 wide, while a word is spoken. */
  open: number;
  blink: boolean;
  /** 0 arm at rest to 1 pointing at the board. */
  point: number;
  look: { x: number; y: number };
  cheer: number;
  wave: number;
  gesture: number;
  /** Seconds into the scene, for the idle bob. */
  t: number;
}

interface Rig {
  name: string;
  tags: readonly string[];
  headTop: number;
  eyeY: number;
  mouthY: number;
  shoulderY: number;
  shoulders: [number, number];
  screen: boolean;
  color: (palette: BoardPalette) => string;
  Body: (props: { color: string; palette: BoardPalette; t: number }) => ReactNode;
}

class Shade {
  static of(hex: string, amount: number): string {
    const value = hex.replace("#", "");
    const channel = (i: number) => {
      const c = parseInt(value.slice(i, i + 2), 16);
      const next = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
      return Math.round(Math.min(255, Math.max(0, next)))
        .toString(16)
        .padStart(2, "0");
    };
    return `#${channel(0)}${channel(2)}${channel(4)}`;
  }
}

export const MASCOTS: Record<MascotRig, Rig> = {
  pip: {
    name: "Pip",
    tags: ["blob", "friendly", "round", "cute"],
    headTop: 60,
    eyeY: 128,
    mouthY: 160,
    shoulderY: 150,
    shoulders: [28, 172],
    screen: false,
    color: (palette) => palette.accent2,
    Body: ({ color }) => (
      <>
        <path
          d="M100 60 C148 60 178 98 178 142 C178 190 146 222 100 222 C54 222 22 190 22 142 C22 98 52 60 100 60 Z"
          fill={color}
          stroke={Shade.of(color, -0.35)}
          strokeWidth={4}
        />
        <ellipse cx={100} cy={176} rx={44} ry={32} fill="#fff" opacity={0.22} />
        <ellipse cx={78} cy={228} rx={18} ry={7} fill={Shade.of(color, -0.35)} />
        <ellipse cx={122} cy={228} rx={18} ry={7} fill={Shade.of(color, -0.35)} />
      </>
    ),
  },
  bolt: {
    name: "Bolt",
    tags: ["robot", "tech", "ai", "machine"],
    headTop: 52,
    eyeY: 102,
    mouthY: 130,
    shoulderY: 182,
    shoulders: [62, 138],
    screen: true,
    color: () => "#C9D3E0",
    Body: ({ color, palette, t }) => (
      <>
        <line x1={100} y1={52} x2={100} y2={30} stroke={Shade.of(color, -0.4)} strokeWidth={5} />
        <circle
          cx={100}
          cy={26}
          r={8}
          fill={palette.accent}
          opacity={0.65 + 0.35 * Math.abs(Math.sin(t * 3))}
        />
        <rect x={62} y={166} width={76} height={50} rx={14} fill={Shade.of(color, -0.12)} />
        <circle cx={100} cy={190} r={8} fill={palette.accent} />
        <rect x={34} y={52} width={132} height={110} rx={30} fill={color} />
        <rect x={48} y={66} width={104} height={82} rx={20} fill="#1B2233" />
        <rect x={70} y={216} width={22} height={12} rx={4} fill={Shade.of(color, -0.4)} />
        <rect x={108} y={216} width={22} height={12} rx={4} fill={Shade.of(color, -0.4)} />
      </>
    ),
  },
};

class Face {
  static brows(mood: Mood, y: number): [number, number, number, number][] {
    switch (mood) {
      case "thinking":
        return [
          [62, y - 2, 90, y - 6],
          [110, y - 14, 138, y - 10],
        ];
      case "surprised":
      case "excited":
        return [
          [62, y - 12, 90, y - 16],
          [110, y - 16, 138, y - 12],
        ];
      case "sad":
        return [
          [62, y - 4, 90, y - 12],
          [110, y - 12, 138, y - 4],
        ];
      default:
        return [
          [62, y - 6, 90, y - 10],
          [110, y - 10, 138, y - 6],
        ];
    }
  }

  static mouth(mood: Mood, open: number, y: number, ink: string, glow: boolean) {
    const stroke = { stroke: ink, strokeWidth: 5, strokeLinecap: "round" as const, fill: "none" };
    const solid = glow ? stroke : { fill: ink };
    if (open > 0.08) {
      const rx = 16 - 3 * open;
      const ry = 3 + 12 * open;
      if (mood === "surprised") {
        return <ellipse cx={100} cy={y} rx={9 + 4 * open} ry={4 + 10 * open} {...solid} />;
      }
      if (mood === "sad" || mood === "thinking") {
        return <ellipse cx={100} cy={y + 2} rx={11 - 2 * open} ry={2 + 9 * open} {...solid} />;
      }
      if (glow) {
        return (
          <path
            d={`M ${100 - rx} ${y - 2} Q 100 ${y + ry * 1.4} ${100 + rx} ${y - 2} Q 100 ${y + 2} ${100 - rx} ${y - 2} Z`}
            {...stroke}
          />
        );
      }
      return (
        <g>
          <path
            d={`M ${100 - rx} ${y - 2} Q 100 ${y + ry * 1.55} ${100 + rx} ${y - 2} Q 100 ${y + 1} ${100 - rx} ${y - 2} Z`}
            fill={ink}
          />
          {open > 0.3 ? (
            <ellipse cx={100} cy={y + ry * 0.55} rx={rx * 0.5} ry={ry * 0.35} fill="#E46A6A" />
          ) : null}
        </g>
      );
    }
    switch (mood) {
      case "sad":
        return <path d={`M84 ${y + 6} Q100 ${y - 8} 116 ${y + 6}`} {...stroke} />;
      case "thinking":
        return <path d={`M90 ${y + 2} L112 ${y - 2}`} {...stroke} />;
      case "surprised":
        return <ellipse cx={100} cy={y} rx={8} ry={10} {...solid} />;
      case "excited":
        return <path d={`M80 ${y - 6} Q100 ${y + 22} 120 ${y - 6} Z`} {...solid} />;
      default:
        return <path d={`M82 ${y - 4} Q100 ${y + 14} 118 ${y - 4}`} {...stroke} />;
    }
  }
}

class Hats {
  static draw(hat: MascotHat, top: number, palette: BoardPalette): ReactNode {
    const dark = "#262626";
    switch (hat) {
      case "cap":
        return (
          <g>
            <path d={`M58 ${top + 14} Q100 ${top - 36} 142 ${top + 14} Z`} fill={palette.accent} />
            <ellipse cx={132} cy={top + 12} rx={36} ry={7} fill={Shade.of(palette.accent, -0.25)} />
            <circle cx={100} cy={top - 10} r={5} fill={Shade.of(palette.accent, -0.25)} />
          </g>
        );
      case "grad":
        return (
          <g>
            <rect x={70} y={top - 12} width={60} height={20} rx={4} fill={dark} />
            <polygon
              points={`100,${top - 30} 162,${top - 12} 100,${top + 4} 38,${top - 12}`}
              fill={dark}
            />
            <path
              d={`M100 ${top - 13} L150 ${top - 6} L150 ${top + 18}`}
              stroke="#F4C430"
              strokeWidth={4}
              fill="none"
            />
            <circle cx={150} cy={top + 20} r={5} fill="#F4C430" />
          </g>
        );
      case "hardhat":
        return (
          <g>
            <path d={`M56 ${top + 16} Q100 ${top - 42} 144 ${top + 16} Z`} fill="#F5B700" />
            <rect x={44} y={top + 10} width={112} height={10} rx={5} fill="#D99A00" />
            <path d={`M100 ${top - 12} L100 ${top + 10}`} stroke="#D99A00" strokeWidth={6} />
          </g>
        );
      case "wizard":
        return (
          <g>
            <polygon points={`58,${top + 14} 142,${top + 14} 116,${top - 64}`} fill="#5B3FA8" />
            <ellipse cx={100} cy={top + 14} rx={54} ry={9} fill="#4A3290" />
            <circle cx={104} cy={top - 20} r={4} fill="#F4C430" />
            <circle cx={116} cy={top - 42} r={3} fill="#F4C430" />
            <circle cx={90} cy={top - 2} r={3} fill="#F4C430" />
          </g>
        );
      case "crown":
        return (
          <g>
            <polygon
              points={`62,${top + 12} 62,${top - 18} 81,${top - 4} 100,${top - 28} 119,${top - 4} 138,${top - 18} 138,${top + 12}`}
              fill="#F4C430"
              stroke="#C99A00"
              strokeWidth={3}
            />
            <circle cx={100} cy={top + 2} r={5} fill={palette.bad} />
            <circle cx={78} cy={top + 4} r={4} fill={palette.accent2} />
            <circle cx={122} cy={top + 4} r={4} fill={palette.good} />
          </g>
        );
      case "beanie":
        return (
          <g>
            <path d={`M56 ${top + 18} Q100 ${top - 42} 144 ${top + 18} Z`} fill={palette.accent} />
            <rect
              x={52}
              y={top + 6}
              width={96}
              height={16}
              rx={8}
              fill={Shade.of(palette.accent, -0.25)}
            />
            <circle cx={100} cy={top - 24} r={11} fill={Shade.of(palette.accent, 0.35)} />
          </g>
        );
      case "headset":
        return (
          <g>
            <path
              d={`M30 ${top + 70} Q100 ${top - 50} 170 ${top + 70}`}
              stroke={dark}
              strokeWidth={8}
              fill="none"
            />
            <rect x={16} y={top + 58} width={20} height={36} rx={9} fill={dark} />
            <rect x={164} y={top + 58} width={20} height={36} rx={9} fill={dark} />
            <path
              d={`M26 ${top + 92} Q40 ${top + 110} 72 ${top + 104}`}
              stroke={dark}
              strokeWidth={5}
              fill="none"
            />
            <circle cx={74} cy={top + 104} r={6} fill={dark} />
          </g>
        );
      default:
        return null;
    }
  }
}

/** One mascot, drawn in SVG from its rig, hat and pose: blinks, bobs, talks while the voice
 *  says a word, and raises an arm toward the board when a piece arrives. */
export function MascotFigure({
  rig,
  hat,
  pose,
  palette,
}: {
  rig: MascotRig;
  hat: MascotHat;
  pose: MascotPose;
  palette: BoardPalette;
}) {
  const shape = MASCOTS[rig] ?? MASCOTS.pip;
  const color = shape.color(palette);
  const ink = shape.screen ? palette.accent2 : "#1F1B16";
  const limb = Shade.of(color, -0.35);
  const bob = Math.sin(pose.t * 2.2) * 3 - 24 * pose.cheer;
  const squash = 1 + 0.015 * Math.sin(pose.t * 4.4) + 0.05 * pose.cheer;
  const tilt = 4 * pose.point + (pose.mood === "thinking" ? 4 * Math.sin(pose.t * 1.3) : 0);
  const eyeRy = pose.blink ? 1.5 : pose.mood === "surprised" ? 20 : 16;
  const y = shape.shoulderY;
  const [left, right] = shape.shoulders;
  const lift = Math.max(pose.point, pose.cheer, pose.wave);
  const sway = pose.wave * 14 * Math.sin(pose.t * 12);
  const hand = { x: right + 10 + 14 * lift + sway, y: y + 36 - 110 * lift };
  const other = Math.max(pose.cheer, 0.3 * pose.gesture);
  const free = { x: left - 10 - 14 * other, y: y + 40 - 110 * other };
  const gaze = { x: 5 * pose.look.x, y: 4 * pose.look.y };

  return (
    <svg viewBox="0 -40 200 280" width="100%" height="100%" style={{ overflow: "visible" }}>
      <g
        transform={`translate(0 ${bob}) rotate(${tilt} 100 230) translate(100 230) scale(1 ${squash}) translate(-100 -230)`}
      >
        <path
          d={`M${left} ${y} Q${left - 20 * (1 - other)} ${y - 40 * other + 18} ${free.x} ${free.y}`}
          stroke={limb}
          strokeWidth={11}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={`M${right} ${y} Q${right + 20 * (1 - lift)} ${y - 40 * lift + 18} ${hand.x} ${hand.y}`}
          stroke={limb}
          strokeWidth={11}
          strokeLinecap="round"
          fill="none"
        />
        <circle cx={free.x} cy={free.y} r={9} fill={limb} />
        <circle cx={hand.x} cy={hand.y} r={9} fill={limb} />
        <shape.Body color={color} palette={palette} t={pose.t} />
        {shape.screen ? null : (
          <>
            <ellipse cx={60} cy={shape.mouthY - 8} rx={9} ry={6} fill="#FF7A8A" opacity={0.35} />
            <ellipse cx={140} cy={shape.mouthY - 8} rx={9} ry={6} fill="#FF7A8A" opacity={0.35} />
          </>
        )}
        {[76, 124].map((cx) =>
          shape.screen ? (
            <ellipse
              key={cx}
              cx={cx + gaze.x * 0.8}
              cy={shape.eyeY + gaze.y * 0.8}
              rx={11}
              ry={pose.blink ? 1.5 : 13}
              fill={ink}
            />
          ) : (
            <g key={cx}>
              <ellipse
                cx={cx}
                cy={shape.eyeY}
                rx={15}
                ry={eyeRy}
                fill="#fff"
                stroke={limb}
                strokeWidth={2}
              />
              {pose.blink ? null : (
                <circle cx={cx + gaze.x} cy={shape.eyeY + gaze.y} r={7.5} fill="#1F1B16" />
              )}
            </g>
          ),
        )}
        {Face.brows(pose.mood, shape.eyeY - 22).map(([x1, y1, x2, y2], i) => (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={ink}
            strokeWidth={5}
            strokeLinecap="round"
          />
        ))}
        {Face.mouth(pose.mood, pose.open, shape.mouthY, ink, shape.screen)}
        {Hats.draw(hat, shape.headTop, palette)}
      </g>
    </svg>
  );
}
