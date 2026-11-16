import { useContext } from "react";
import { BoardElementsContext, BoardGlyphs, ElementPaths } from "../explainer/elements/glyph.tsx";

export class SkitPictures {
  static built<T extends string>(name: string | undefined, kinds: readonly T[]): T | null {
    if (!name) return null;
    const key = name
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    return (kinds as readonly string[]).includes(key) ? (key as T) : null;
  }
}

export function SetGlyph({
  name,
  x,
  y,
  size,
  color,
  stroke = 2,
  mirror = false,
}: {
  name: string | undefined;
  x: number;
  y: number;
  size: number;
  color: string;
  stroke?: number;
  mirror?: boolean;
}) {
  const found = BoardGlyphs.find(name, useContext(BoardElementsContext));
  if (!found) return null;
  const flip = mirror ? `translate(${x * 2 + size} 0) scale(-1 1)` : undefined;
  if ("icon" in found) {
    const Icon = found.icon;
    return (
      <g transform={flip}>
        <Icon x={x} y={y} width={size} height={size} color={color} strokeWidth={stroke} />
      </g>
    );
  }
  const { shape, kind } = found.element;
  const logo = kind === "logo";
  const inner = logo ? size * 0.78 : size;
  const off = (size - inner) / 2;
  return (
    <g transform={flip}>
      {logo ? (
        <rect x={x} y={y} width={size} height={size} rx={size * 0.22} fill="#ffffff" />
      ) : null}
      <svg
        x={x + off}
        y={y + off}
        width={inner}
        height={inner}
        viewBox={`0 0 ${shape.box.w} ${shape.box.h}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <ElementPaths element={found.element} color={color} />
      </svg>
    </g>
  );
}
