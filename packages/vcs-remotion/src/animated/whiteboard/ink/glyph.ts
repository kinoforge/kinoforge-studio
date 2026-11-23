import type { LucideIcon } from "lucide-react";
import { BoardGlyphs } from "../../shared/elements/glyph.tsx";
import type { BoardElements } from "../../shared/elements/spec.ts";

export interface GlyphPart {
  d: string;
  fill: string | null;
  width: number | null;
  evenodd: boolean;
}

export interface Glyph {
  w: number;
  h: number;
  parts: GlyphPart[];
  logo: boolean;
  kit: boolean;
}

type IconNode = [string, Record<string, string | number>][];

export class GlyphInk {
  private static readonly cache = new Map<LucideIcon, Glyph>();

  static find(name: string, pictures: BoardElements): Glyph | null {
    const found = BoardGlyphs.find(name, pictures);
    if (!found) return null;
    if ("icon" in found) return GlyphInk.icon(found.icon);
    const { shape } = found.element;
    return {
      w: shape.box.w,
      h: shape.box.h,
      kit: false,
      logo: found.element.kind === "logo",
      parts: shape.parts.map((part) => ({
        d: part.d,
        fill: part.fill === "none" ? null : (part.fill ?? (part.stroke ? null : "ink")),
        width: part.stroke && part.stroke !== "none" ? (part.width ?? null) : null,
        evenodd: !!part.evenodd,
      })),
    };
  }

  static icon(icon: LucideIcon): Glyph {
    const known = GlyphInk.cache.get(icon);
    if (known) return known;
    const made = { w: 24, h: 24, logo: false, kit: true, parts: GlyphInk.nodes(icon).map((d) => ({ d, fill: null, width: null, evenodd: false })) };
    GlyphInk.cache.set(icon, made);
    return made;
  }

  static nodes(icon: LucideIcon): string[] {
    const render = (icon as unknown as { render?: (props: object, ref: null) => { props?: { iconNode?: IconNode; icon?: { node?: IconNode } } } }).render;
    const props = render?.({}, null)?.props;
    const node = props?.iconNode ?? props?.icon?.node ?? [];
    return node.map(([tag, attrs]) => GlyphInk.path(tag, attrs)).filter((d): d is string => !!d);
  }

  static path(tag: string, a: Record<string, string | number>): string | null {
    const n = (key: string) => Number(a[key] ?? 0);
    switch (tag) {
      case "path":
        return String(a.d ?? "") || null;
      case "line":
        return `M${n("x1")} ${n("y1")}L${n("x2")} ${n("y2")}`;
      case "circle":
        return GlyphInk.oval(n("cx"), n("cy"), n("r"), n("r"));
      case "ellipse":
        return GlyphInk.oval(n("cx"), n("cy"), n("rx"), n("ry"));
      case "rect": {
        const x = n("x");
        const y = n("y");
        const w = n("width");
        const h = n("height");
        const r = Math.min(n("rx") || n("ry"), w / 2, h / 2);
        if (!r) return `M${x} ${y}h${w}v${h}h${-w}Z`;
        return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
      }
      case "polyline":
      case "polygon": {
        const nums = String(a.points ?? "").trim().split(/[\s,]+/).map(Number);
        const pairs: string[] = [];
        for (let i = 0; i + 1 < nums.length; i += 2) pairs.push(`${i ? "L" : "M"}${nums[i]} ${nums[i + 1]}`);
        return pairs.length ? pairs.join("") + (tag === "polygon" ? "Z" : "") : null;
      }
      default:
        return null;
    }
  }

  private static oval(cx: number, cy: number, rx: number, ry: number): string {
    return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`;
  }
}
