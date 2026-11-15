import { createContext, useContext } from "react";
import type { LucideIcon } from "lucide-react";
import { BOARD_ICONS, type BoardIcon } from "../icons/index.ts";
import type { BoardElement, BoardElements } from "./spec.ts";

export const BoardElementsContext = createContext<BoardElements>({});

export class IconNames {
  private static readonly tagged = IconNames.tags();

  static key(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.+ -]/g, "")
      .replace(/\s+/g, "-");
  }

  static kit(name: string): BoardIcon | null {
    const key = IconNames.key(name);
    if (key in BOARD_ICONS) return key as BoardIcon;
    const words = key.replace(/-/g, " ");
    return IconNames.tagged.get(words) ?? IconNames.tagged.get(words.replace(/s$/, "")) ?? null;
  }

  private static tags(): Map<string, BoardIcon> {
    const out = new Map<string, BoardIcon>();
    for (const [key, entry] of Object.entries(BOARD_ICONS) as [
      BoardIcon,
      { tags: readonly string[] },
    ][]) {
      for (const tag of entry.tags) if (!out.has(tag)) out.set(tag, key);
    }
    return out;
  }
}

type Found = { icon: LucideIcon } | { element: BoardElement };

export class BoardGlyphs {
  static find(name: string | undefined, elements: BoardElements): Found | null {
    if (!name) return null;
    const stored = elements[name] ?? elements[IconNames.key(name)];
    if (stored) return { element: stored };
    const kit = IconNames.kit(name);
    return kit ? { icon: BOARD_ICONS[kit].icon } : null;
  }
}

function ElementShapeView({
  element,
  size,
  color,
}: {
  element: BoardElement;
  size: number;
  color: string;
}) {
  const { w, h } = element.shape.box;
  const paint = (value: string | undefined, fallback: string) =>
    value === "ink" ? color : (value ?? fallback);
  const logo = element.kind === "logo";
  const inner = logo ? size * 0.78 : size;
  const svg = (
    <svg width={inner} height={inner} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      {element.shape.parts.map((part, i) => (
        <path
          key={i}
          d={part.d}
          fill={paint(part.fill, part.stroke ? "none" : color)}
          stroke={paint(part.stroke, "none")}
          strokeWidth={part.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={part.opacity}
          fillRule={part.evenodd ? "evenodd" : undefined}
        />
      ))}
    </svg>
  );
  if (!logo) return svg;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: "#ffffff",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {svg}
    </div>
  );
}

export function BoardGlyph({
  name,
  size,
  color,
  stroke = 2.2,
  fallback,
}: {
  name: string | undefined;
  size: number;
  color: string;
  stroke?: number;
  fallback?: string;
}) {
  const found = BoardGlyphs.find(name, useContext(BoardElementsContext));
  if (!found) {
    const letter = fallback?.trim().charAt(0).toUpperCase();
    return letter ? (
      <span style={{ fontSize: size * 0.8, fontWeight: 800, color, lineHeight: 1 }}>{letter}</span>
    ) : null;
  }
  if ("icon" in found) {
    const Icon = found.icon;
    return <Icon size={size} color={color} strokeWidth={stroke} />;
  }
  return <ElementShapeView element={found.element} size={size} color={color} />;
}
