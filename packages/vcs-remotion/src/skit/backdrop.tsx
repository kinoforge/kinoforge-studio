import type { ReactNode } from "react";
import type { BoardPalette } from "../explainer/theme.ts";
import { SetPiece } from "./props.tsx";
import type { Backdrop } from "./spec.ts";

interface Room {
  width: number;
  floor: number;
  unit: number;
}

class BackdropPlan {
  static readonly SKYLINE = [112, 150, 92, 134, 172, 104, 142, 120, 160, 96];
  static readonly BLOCK = 40;

  static at(room: Room, share: number, node: ReactNode, key: string) {
    return (
      <g key={key} transform={`translate(${share * room.width} ${room.floor}) scale(${room.unit})`}>
        {node}
      </g>
    );
  }

  static stars(room: Room, count: number): [number, number, number][] {
    const out: [number, number, number][] = [];
    let seed = 7;
    const next = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < count; i++)
      out.push([next() * room.width, -40 - next() * 190, 0.5 + next()]);
    return out;
  }
}

export function SetBackdrop({
  kind,
  room,
  palette,
  t,
}: {
  kind: Backdrop;
  room: Room;
  palette: BoardPalette;
  t: number;
}) {
  const ink = palette.muted;
  const line = {
    stroke: ink,
    strokeWidth: 1.1,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const soft = { fill: palette.card, fillOpacity: 0.3 };
  const { width, floor, unit: u } = room;
  const y = (units: number) => floor + units * u;
  const at = (share: number, node: ReactNode, key: string) =>
    BackdropPlan.at(room, share, node, key);
  switch (kind) {
    case "plain":
      return null;
    case "office":
      return (
        <g>
          {at(0.5, <SetPiece name="window" palette={palette} t={t} />, "window")}
          {at(0.17, <SetPiece name="clock" palette={palette} t={t} />, "clock")}
          {at(
            0.85,
            <g {...line} fill="none">
              <line x1={-18} y1={-96} x2={18} y2={-96} />
              {[-14, -9, -4, 3, 9].map((x, i) => (
                <rect
                  key={x}
                  x={x}
                  y={-96 - 9 - (i % 2) * 2}
                  width={4}
                  height={9 + (i % 2) * 2}
                  {...soft}
                />
              ))}
            </g>,
            "shelf",
          )}
        </g>
      );
    case "classroom":
      return (
        <g>
          {at(
            0.5,
            <g {...line}>
              <rect
                x={-58}
                y={-122}
                width={116}
                height={50}
                rx={2}
                fill="#2F4F3A"
                fillOpacity={0.55}
              />
              <path
                d="M -46 -106 q 8 -6 16 0 t 16 0 M -40 -92 h 30 M 8 -108 l 24 0 M 10 -96 l 18 8"
                stroke={palette.ink}
                strokeOpacity={0.45}
                fill="none"
              />
              <line x1={-58} y1={-70} x2={58} y2={-70} />
            </g>,
            "board",
          )}
          {at(0.88, <SetPiece name="clock" palette={palette} t={t} />, "clock")}
        </g>
      );
    case "kitchen":
      return (
        <g {...line}>
          <rect x={0} y={y(-36)} width={width} height={36 * u} {...soft} stroke="none" />
          <line x1={0} y1={y(-36)} x2={width} y2={y(-36)} />
          {Array.from({ length: Math.ceil(width / (26 * u)) }, (_, i) => (
            <line key={i} x1={i * 26 * u} y1={y(-33)} x2={i * 26 * u} y2={y(-3)} />
          ))}
          {[0.08, 0.6].map((share) => (
            <rect
              key={share}
              x={share * width}
              y={y(-124)}
              width={width * 0.3}
              height={30 * u}
              rx={u}
              {...soft}
              stroke="none"
            />
          ))}
          {at(
            0.9,
            <g>
              <rect
                x={-14}
                y={-98}
                width={28}
                height={98}
                rx={3}
                fill={palette.card}
                fillOpacity={0.45}
              />
              <line x1={-14} y1={-66} x2={14} y2={-66} />
              <line x1={9} y1={-88} x2={9} y2={-74} />
            </g>,
            "fridge",
          )}
        </g>
      );
    case "home":
      return (
        <g {...line}>
          {at(
            0.5,
            <g>
              <rect x={-40} y={-44} width={80} height={22} rx={6} {...soft} />
              <rect
                x={-44}
                y={-24}
                width={88}
                height={14}
                rx={4}
                fill={palette.accent2}
                fillOpacity={0.18}
              />
              <rect x={-24} y={-118} width={48} height={32} rx={1} {...soft} />
              <path
                d="M -16 -94 l 10 -12 l 8 8 l 6 -5 l 8 9"
                fill="none"
                stroke={palette.accent}
                strokeOpacity={0.6}
              />
            </g>,
            "sofa",
          )}
          {at(
            0.13,
            <g>
              <line x1={0} y1={0} x2={0} y2={-74} />
              <path
                d="M -10 -74 L 10 -74 L 6 -92 L -6 -92 Z"
                fill={palette.warn}
                fillOpacity={0.3}
              />
            </g>,
            "lamp",
          )}
          {at(0.86, <SetPiece name="window" palette={palette} t={t} />, "window")}
        </g>
      );
    case "bedroom":
      return (
        <g {...line}>
          {at(
            0.5,
            <g>
              <rect x={-50} y={-66} width={8} height={66} rx={2} {...soft} />
              <rect x={-44} y={-30} width={92} height={18} rx={3} {...soft} />
              <rect
                x={-44}
                y={-40}
                width={90}
                height={12}
                rx={4}
                fill={palette.card}
                fillOpacity={0.2}
              />
              <ellipse cx={-32} cy={-44} rx={10} ry={5} fill={palette.card} fillOpacity={0.4} />
              <rect
                x={-16}
                y={-43}
                width={62}
                height={16}
                rx={4}
                fill={palette.accent2}
                fillOpacity={0.2}
              />
              <line x1={-40} y1={-12} x2={-40} y2={0} />
              <line x1={42} y1={-12} x2={42} y2={0} />
            </g>,
            "bed",
          )}
          {at(
            0.14,
            <g>
              <rect x={-12} y={-30} width={24} height={30} rx={2} {...soft} />
              <line x1={0} y1={-30} x2={0} y2={-46} />
              <path d="M -9 -46 L 9 -46 L 6 -58 L -6 -58 Z" fill={palette.warn} fillOpacity={0.3} />
            </g>,
            "nightstand",
          )}
          {at(0.86, <SetPiece name="window" palette={palette} t={t} />, "window")}
        </g>
      );
    case "bathroom":
      return (
        <g {...line}>
          <rect x={0} y={y(-58)} width={width} height={58 * u} {...soft} stroke="none" />
          <line x1={0} y1={y(-58)} x2={width} y2={y(-58)} />
          {Array.from({ length: Math.ceil(width / (18 * u)) }, (_, i) => (
            <line key={i} x1={i * 18 * u} y1={y(-55)} x2={i * 18 * u} y2={y(-3)} />
          ))}
          {at(
            0.5,
            <g>
              <rect
                x={-20}
                y={-132}
                width={40}
                height={48}
                rx={10}
                fill={palette.accent2}
                fillOpacity={0.12}
              />
              <path d="M -10 -122 l 8 -6 M -12 -112 l 16 -12" fill="none" strokeOpacity={0.6} />
              <path
                d="M -24 -66 h 48 q -2 16 -24 16 q -22 0 -24 -16 z"
                fill={palette.card}
                fillOpacity={0.5}
              />
              <rect x={-5} y={-50} width={10} height={50} {...soft} />
              <path d="M 0 -66 v -8 h 8" fill="none" />
            </g>,
            "sink",
          )}
          {at(
            0.86,
            <g>
              <line x1={-16} y1={-100} x2={16} y2={-100} />
              <rect
                x={-11}
                y={-100}
                width={22}
                height={30}
                rx={2}
                fill={palette.accent}
                fillOpacity={0.2}
              />
            </g>,
            "towel",
          )}
          {at(
            0.15,
            <g>
              <line x1={-16} y1={-92} x2={16} y2={-92} />
              <rect x={-5} y={-104} width={10} height={12} rx={2} {...soft} />
              <line x1={-2} y1={-104} x2={-4} y2={-112} />
              <line x1={2} y1={-104} x2={4} y2={-112} />
            </g>,
            "cup",
          )}
        </g>
      );
    case "street":
      return (
        <g {...line} strokeOpacity={0.7}>
          {Array.from({ length: Math.ceil(width / (BackdropPlan.BLOCK * u)) + 1 }, (_, i) => {
            const tall = BackdropPlan.SKYLINE[i % BackdropPlan.SKYLINE.length];
            const x = i * BackdropPlan.BLOCK * u;
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y(-tall)}
                  width={(BackdropPlan.BLOCK - 4) * u}
                  height={tall * u}
                  {...soft}
                />
                {Array.from({ length: Math.floor((tall - 20) / 18) }, (_, row) => (
                  <g key={row}>
                    <rect
                      x={x + 8 * u}
                      y={y(-tall + 12 + row * 18)}
                      width={6 * u}
                      height={7 * u}
                      fill={palette.warn}
                      fillOpacity={(row + i) % 3 ? 0.08 : 0.3}
                      stroke="none"
                    />
                    <rect
                      x={x + 22 * u}
                      y={y(-tall + 12 + row * 18)}
                      width={6 * u}
                      height={7 * u}
                      fill={palette.warn}
                      fillOpacity={(row + i) % 2 ? 0.08 : 0.25}
                      stroke="none"
                    />
                  </g>
                ))}
              </g>
            );
          })}
          {at(
            0.08,
            <g>
              <line x1={0} y1={0} x2={0} y2={-92} strokeWidth={2.4} />
              <path d="M 0 -92 q 8 0 10 6" fill="none" />
              <circle cx={10} cy={-84} r={3} fill={palette.warn} fillOpacity={0.6} />
            </g>,
            "lamp",
          )}
        </g>
      );
    case "park":
      return (
        <g {...line}>
          {[0.1, 0.9].map((share) =>
            at(
              share,
              <g>
                <rect x={-3} y={-44} width={6} height={44} fill={palette.card} fillOpacity={0.4} />
                <circle cx={0} cy={-62} r={22} fill={palette.good} fillOpacity={0.22} />
                <circle cx={-12} cy={-50} r={14} fill={palette.good} fillOpacity={0.22} />
                <circle cx={12} cy={-52} r={15} fill={palette.good} fillOpacity={0.22} />
              </g>,
              `tree-${share}`,
            ),
          )}
          {[0.32, 0.66].map((share, i) =>
            at(
              share,
              <path
                d={`M ${-14 + i * 4} -132 q 4 -10 14 -6 q 8 -8 16 0 q 10 0 8 8 z`}
                fill={palette.card}
                fillOpacity={0.35}
              />,
              `cloud-${share}`,
            ),
          )}
          {at(
            0.84,
            <g stroke="none">
              <circle cx={0} cy={-150} r={17} fill={palette.warn} fillOpacity={0.18} />
              <circle cx={0} cy={-150} r={11} fill={palette.warn} fillOpacity={0.85} />
            </g>,
            "sun",
          )}
        </g>
      );
    case "lab":
      return (
        <g {...line}>
          {at(
            0.18,
            <g>
              <line x1={-24} y1={-92} x2={24} y2={-92} />
              <path d="M -18 -92 l 4 -14 h 2 l 4 14 z" fill={palette.good} fillOpacity={0.35} />
              <rect
                x={-4}
                y={-106}
                width={7}
                height={14}
                rx={1}
                fill={palette.accent2}
                fillOpacity={0.35}
              />
              <circle cx={14} cy={-99} r={6} fill={palette.warn} fillOpacity={0.3} />
            </g>,
            "shelf",
          )}
          {at(
            0.86,
            <g>
              <rect x={-16} y={-64} width={32} height={64} rx={2} {...soft} />
              <circle cx={-6} cy={-48} r={4} fill="none" />
              <circle cx={7} cy={-48} r={4} fill="none" />
              <rect
                x={-10}
                y={-32}
                width={20}
                height={9}
                rx={1}
                fill={palette.good}
                fillOpacity={0.3 + 0.2 * Math.sin(t * 3)}
              />
            </g>,
            "machine",
          )}
        </g>
      );
    case "shop":
      return (
        <g {...line}>
          {[-104, -72].map((level) => (
            <g key={level}>
              <line x1={width * 0.04} y1={y(level)} x2={width * 0.96} y2={y(level)} />
              {Array.from({ length: Math.floor((width * 0.9) / (14 * u)) }, (_, i) => (
                <rect
                  key={i}
                  x={width * 0.05 + i * 14 * u}
                  y={y(level - 10 - (i % 3) * 2)}
                  width={9 * u}
                  height={(10 + (i % 3) * 2) * u}
                  fill={i % 2 ? palette.accent2 : palette.warn}
                  fillOpacity={0.18}
                />
              ))}
            </g>
          ))}
          {at(
            0.84,
            <rect
              x={-26}
              y={-36}
              width={52}
              height={36}
              rx={2}
              fill={palette.card}
              fillOpacity={0.45}
            />,
            "counter",
          )}
        </g>
      );
    case "stage": {
      const top = y(-210);
      const curtain = (left: number, right: number) =>
        `M ${left} ${top} L ${right} ${top} Q ${(left + right) / 2} ${floor - 60 * u} ${right} ${floor} L ${left} ${floor} Z`;
      return (
        <g>
          <path
            d={`M ${width * 0.42} ${top} L ${width * 0.58} ${top} L ${width * 0.8} ${floor} L ${width * 0.2} ${floor} Z`}
            fill="#ffffff"
            fillOpacity={0.05}
          />
          <path d={curtain(0, width * 0.13)} fill="#8B1E2D" fillOpacity={0.55} />
          <path d={curtain(width, width * 0.87)} fill="#8B1E2D" fillOpacity={0.55} />
          <rect x={0} y={top} width={width} height={14 * u} fill="#8B1E2D" fillOpacity={0.6} />
        </g>
      );
    }
    case "space":
      return (
        <g>
          {BackdropPlan.stars(room, 46).map(([x, level, r], i) => (
            <circle
              key={i}
              cx={x}
              cy={y(level)}
              r={r * u * 0.5}
              fill={palette.ink}
              opacity={0.35 + 0.35 * Math.abs(Math.sin(t * 1.3 + i))}
            />
          ))}
          {at(
            0.82,
            <g {...line}>
              <circle cx={0} cy={-132} r={15} fill={palette.accent2} fillOpacity={0.35} />
              <ellipse cx={0} cy={-132} rx={26} ry={6} fill="none" transform="rotate(-14 0 -132)" />
            </g>,
            "planet",
          )}
          {[0.2, 0.55, 0.78].map((share) =>
            at(
              share,
              <ellipse cx={0} cy={2} rx={9} ry={2} fill={palette.card} fillOpacity={0.4} />,
              `crater-${share}`,
            ),
          )}
        </g>
      );
  }
}
