import type { PieceProps } from "../pieces/ease.ts";
import { Ease } from "../pieces/ease.ts";
import { BOARD_FONT } from "../theme.ts";
import { FitText } from "../timeline.ts";
import type { SignKind } from "./spec.ts";

const RED = "#C8102E";
const BLUE = "#1F5FAD";
const YELLOW = "#FFC20E";
const INK = "#16181D";
const WHITE = "#FFFFFF";

const octagon = Array.from({ length: 8 }, (_, i) => {
  const a = Math.PI / 8 + (i * Math.PI) / 4;
  return `${50 + 48 * Math.cos(a)},${50 + 48 * Math.sin(a)}`;
}).join(" ");

function Ring({ fill = WHITE }: { fill?: string }) {
  return <circle cx={50} cy={50} r={44} fill={fill} stroke={RED} strokeWidth={10} />;
}

function Arrows() {
  // Three arrows chasing each other round, the way a roundabout turns for traffic on the right.
  return (
    <g fill="none" stroke={WHITE} strokeWidth={7} strokeLinecap="round">
      {[0, 120, 240].map((turn) => (
        <g key={turn} transform={`rotate(${turn} 50 50)`}>
          <path d="M 72 38 A 26 26 0 0 0 38 26" />
          <path d="M 38 26 l 9 -7 M 38 26 l 9 7" />
        </g>
      ))}
    </g>
  );
}

function Car({ x, color }: { x: number; color: string }) {
  return (
    <g transform={`translate(${x} 50)`} fill={color}>
      <rect x={-10} y={-8} width={20} height={14} rx={4} />
      <rect x={-7} y={-15} width={14} height={9} rx={3} />
      <rect x={-10} y={4} width={5} height={6} rx={1.5} />
      <rect x={5} y={4} width={5} height={6} rx={1.5} />
    </g>
  );
}

/** A road sign as drawn in most of Europe, in a 100 by 100 box. */
export function SignArt({ kind, value }: { kind: SignKind; value?: number }) {
  switch (kind) {
    case "stop":
      return (
        <>
          <polygon points={octagon} fill={RED} stroke={WHITE} strokeWidth={4} />
          <text
            x={50}
            y={60}
            textAnchor="middle"
            fontFamily={BOARD_FONT}
            fontWeight={900}
            fontSize={27}
            fill={WHITE}
          >
            STOP
          </text>
        </>
      );
    case "give-way":
      return (
        <polygon
          points="6,10 94,10 50,90"
          fill={WHITE}
          stroke={RED}
          strokeWidth={10}
          strokeLinejoin="round"
        />
      );
    case "danger":
      return (
        <>
          <polygon
            points="50,8 94,88 6,88"
            fill={WHITE}
            stroke={RED}
            strokeWidth={10}
            strokeLinejoin="round"
          />
          <rect x={46} y={36} width={8} height={30} rx={3} fill={INK} />
          <circle cx={50} cy={75} r={4.5} fill={INK} />
        </>
      );
    case "speed-limit":
      return (
        <>
          <Ring />
          <text
            x={50}
            y={62}
            textAnchor="middle"
            fontFamily={BOARD_FONT}
            fontWeight={900}
            fontSize={String(value ?? 50).length > 2 ? 30 : 38}
            fill={INK}
          >
            {value ?? 50}
          </text>
        </>
      );
    case "no-entry":
      return (
        <>
          <circle cx={50} cy={50} r={46} fill={RED} />
          <rect x={18} y={42} width={64} height={16} rx={2} fill={WHITE} />
        </>
      );
    case "roundabout":
      return (
        <>
          <circle cx={50} cy={50} r={46} fill={BLUE} />
          <Arrows />
        </>
      );
    case "priority-road":
      return (
        <>
          <polygon points="50,4 96,50 50,96 4,50" fill={WHITE} stroke={INK} strokeWidth={2} />
          <polygon points="50,18 82,50 50,82 18,50" fill={YELLOW} />
        </>
      );
    case "crossing":
      return (
        <>
          <rect x={6} y={6} width={88} height={88} rx={8} fill={BLUE} />
          <polygon points="50,16 86,82 14,82" fill={WHITE} />
          <g fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round">
            <circle cx={52} cy={38} r={5} fill={INK} stroke="none" />
            <path d="M 51 46 L 48 62 L 40 74 M 48 62 L 58 74 M 50 50 L 40 56 M 50 50 L 60 56" />
          </g>
          {[30, 42, 54, 66].map((x) => (
            <rect key={x} x={x} y={77} width={7} height={3} fill={INK} />
          ))}
        </>
      );
    case "no-overtaking":
      return (
        <>
          <Ring />
          <Car x={36} color={RED} />
          <Car x={64} color={INK} />
        </>
      );
    case "no-parking":
      return (
        <>
          <Ring fill={BLUE} />
          <line x1={22} y1={22} x2={78} y2={78} stroke={RED} strokeWidth={9} />
        </>
      );
    case "no-stopping":
      return (
        <>
          <Ring fill={BLUE} />
          <line x1={22} y1={22} x2={78} y2={78} stroke={RED} strokeWidth={9} />
          <line x1={78} y1={22} x2={22} y2={78} stroke={RED} strokeWidth={9} />
        </>
      );
  }
}

/** A road sign on a card, popping in, with what it means beside it. */
export function SignView({ piece, w, h, t, palette }: PieceProps<"sign">) {
  const side = piece.label ? Math.min(h, w * 0.42) : Math.min(h, w);
  const pop = Ease.pop(t, 0.55);
  const room = { w: w - side - h * 0.2, h };
  const size = piece.label ? FitText.size(piece.label, room, Math.round(h * 0.26), 3) : 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: piece.label ? "flex-start" : "center",
        gap: h * 0.2,
        height: "100%",
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={side}
        height={side}
        style={{
          flexShrink: 0,
          transform: `scale(${Math.max(0, pop)}) rotate(${(1 - Ease.clamp(t * 2)) * -8}deg)`,
        }}
      >
        <SignArt kind={piece.kind} value={piece.value} />
      </svg>
      {piece.label ? (
        <div
          style={{
            fontWeight: 800,
            fontSize: size,
            lineHeight: 1.2,
            color: palette.cardInk,
            opacity: Ease.out(t, 0.4, 0.25),
          }}
        >
          {piece.label}
        </div>
      ) : null}
    </div>
  );
}
