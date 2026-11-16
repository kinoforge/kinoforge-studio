import type { BoardPalette } from "../explainer/theme.ts";
import { SetGlyph, SkitPictures } from "./glyph.tsx";
import { SET_PROPS } from "./spec.ts";

export class SetPieces {
  static readonly SIZE = 38;
}

export function SetPiece({ name, palette, t }: { name: string; palette: BoardPalette; t: number }) {
  const ink = palette.muted;
  const kind = SkitPictures.built(name, SET_PROPS);
  if (!kind) {
    const size = SetPieces.SIZE;
    return <SetGlyph name={name} x={-size / 2} y={-size} size={size} color={palette.accent2} stroke={1.6} />;
  }
  const stroke = { stroke: ink, strokeWidth: 1.8, strokeLinecap: "round" as const, fill: "none" };
  switch (kind) {
    case "whiteboard":
      return (
        <g {...stroke}>
          <rect x={-34} y={-96} width={68} height={42} rx={2} fill={palette.card} fillOpacity={0.5} />
          <line x1={-24} y1={0} x2={-18} y2={-54} />
          <line x1={24} y1={0} x2={18} y2={-54} />
          <path d="M -24 -84 q 8 -6 16 0 t 16 0" stroke={palette.accent2} />
          <path d="M -22 -70 h 20 M 6 -72 l 12 8" stroke={palette.accent} />
        </g>
      );
    case "server": {
      const blink = (i: number) => (Math.sin(t * 5 + i * 1.7) > 0 ? palette.good : palette.muted);
      return (
        <g {...stroke}>
          <rect x={-14} y={-76} width={28} height={76} rx={2} fill={palette.card} fillOpacity={0.6} />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={-9} y1={-66 + i * 14} x2={4} y2={-66 + i * 14} />
              <circle cx={8} cy={-66 + i * 14} r={1.6} fill={blink(i)} stroke="none" />
            </g>
          ))}
        </g>
      );
    }
    case "plant":
      return (
        <g {...stroke}>
          <path d="M -8 0 L -10 -14 L 10 -14 L 8 0 Z" fill={palette.card} fillOpacity={0.6} />
          <path d="M 0 -14 C -2 -26 -12 -30 -16 -38 M 0 -14 C 2 -28 10 -32 14 -42 M 0 -14 C 0 -26 0 -34 1 -46" stroke={palette.good} strokeWidth={2.2} />
        </g>
      );
    case "door":
      return (
        <g {...stroke}>
          <rect x={-16} y={-82} width={32} height={82} rx={1} fill={palette.card} fillOpacity={0.35} />
          <circle cx={10} cy={-40} r={1.8} fill={ink} />
        </g>
      );
    case "window":
      return (
        <g {...stroke}>
          <rect x={-24} y={-104} width={48} height={36} rx={2} fill={palette.accent2} fillOpacity={0.08} />
          <line x1={0} y1={-104} x2={0} y2={-68} />
          <line x1={-24} y1={-86} x2={24} y2={-86} />
        </g>
      );
    case "clock": {
      const a = (t * 40 * Math.PI) / 180;
      return (
        <g {...stroke}>
          <circle cx={0} cy={-92} r={9} fill={palette.card} fillOpacity={0.5} />
          <line x1={0} y1={-92} x2={0} y2={-98} />
          <line x1={0} y1={-92} x2={Math.sin(a) * 7} y2={-92 - Math.cos(a) * 7} stroke={palette.accent} />
        </g>
      );
    }
  }
}
