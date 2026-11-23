import type { BoardElements } from "../shared/elements/spec.ts";
import { HandFont, type HandWeight } from "./hand/font.ts";
import { GlyphInk } from "./ink/glyph.ts";
import { type InkDraft, Inks } from "./ink/ink.ts";
import { PathInk, type Point, Polyline } from "./ink/path.ts";
import { Rough } from "./ink/rough.ts";
import type { Box, ItemSpot } from "./layout.ts";
import type { WbInk, WbPiece, WbPieceOf } from "./spec.ts";
import { type WbPalette, WbPalettes } from "./theme.ts";

export interface DrawContext {
  unit: number;
  palette: WbPalette;
  pictures: BoardElements;
  spots: Map<string, ItemSpot>;
  arrows: Map<string, Point[]>;
  key: string;
}

export class PieceInk {
  constructor(private readonly ctx: DrawContext) {}

  draw(piece: WbPiece, box: Box): InkDraft[] {
    switch (piece.type) {
      case "title":
        return this.title(piece, box);
      case "write":
        return this.write(piece, box);
      case "list":
        return this.list(piece, box);
      case "draw":
        return piece.items.flatMap((item) => this.item(item.id));
      case "link":
        return this.link(piece.from, piece.to, piece.label, piece.ink ?? "ink");
      case "flow":
        return this.flow(piece);
      case "circle":
        return this.circle(piece);
      case "cross":
        return this.cross(piece);
      case "number":
        return this.number(piece, box);
      case "bars":
        return this.bars(piece, box);
      case "compare":
        return this.compare(piece, box);
      case "formula":
        return this.formula(piece, box);
    }
  }

  private get speed() {
    return this.ctx.unit * 0.95;
  }

  private get pen() {
    return this.ctx.unit * 0.0068;
  }

  private ink(name: WbInk = "ink"): string {
    return this.ctx.palette.inks[name];
  }

  private rng(tag: string) {
    return Rough.random(`${this.ctx.key}:${tag}`);
  }

  private words(
    text: string,
    box: { x: number; y: number; w: number; h: number },
    most: number,
    weight: HandWeight,
    color: string,
    maxLines = 3,
  ): { draft: InkDraft; height: number; width: number; size: number } {
    const block = HandFont.fit(text, box, most, weight, maxLines);
    const widths = block.lines.map((line) => HandFont.width(line, block.size, weight));
    const y = box.y + (box.h - block.height) / 2;
    return {
      draft: Inks.text(block.lines, widths, box.x + box.w / 2, y, block.size, weight, color),
      height: block.height,
      width: block.width,
      size: block.size,
    };
  }

  private title(piece: WbPieceOf<"title">, box: Box): InkDraft[] {
    const { unit } = this.ctx;
    const tall = box.w < unit * 0.95;
    const kicker = piece.kicker ? HandFont.fit(piece.kicker, { w: box.w, h: box.h * 0.26 }, unit * 0.042, "regular", 1) : null;
    const head = HandFont.fit(piece.text, { w: box.w, h: box.h * (kicker ? 0.58 : 0.72) }, unit * (tall ? 0.088 : 0.08), "bold", 2);
    const gap = head.size * 0.12;
    const total = (kicker ? kicker.height + gap : 0) + head.height + head.size * 0.35;
    let y = box.y + (box.h - total) / 2;
    const cx = box.x + box.w / 2;
    const out: InkDraft[] = [];
    if (kicker) {
      out.push(Inks.text(kicker.lines, kicker.lines.map((l) => HandFont.width(l, kicker.size)), cx, y, kicker.size, "regular", this.ink("blue")));
      y += kicker.height + gap;
    }
    out.push(Inks.text(head.lines, head.lines.map((l) => HandFont.width(l, head.size, "bold")), cx, y, head.size, "bold", this.ink()));
    const lineY = y + head.height + head.size * 0.12;
    const w = Math.min(box.w, head.width * 1.04);
    out.push(Inks.line([Rough.underline(cx - w / 2, lineY, w, this.rng("title"))], this.pen * 1.4, this.ink("red"), this.speed * 1.6));
    return out;
  }

  private write(piece: WbPieceOf<"write">, box: Box): InkDraft[] {
    return [this.words(piece.text, box, this.ctx.unit * 0.056, "regular", this.ink(piece.ink), 4).draft];
  }

  private list(piece: WbPieceOf<"list">, box: Box): InkDraft[] {
    const { unit } = this.ctx;
    const n = piece.items.length;
    const row = Math.min(box.h / n, unit * 0.12);
    const bullet = row * 0.5;
    const room = { w: box.w - bullet * 1.6, h: row * 0.9 };
    const size = Math.min(...piece.items.map((item) => HandFont.fit(item, room, Math.min(row * 0.62, unit * 0.056), "regular", 1).size));
    const widest = Math.max(...piece.items.map((item) => HandFont.width(item, size)));
    const left = box.x + (box.w - (bullet * 1.6 + widest)) / 2;
    const top = box.y + (box.h - row * n) / 2;
    return piece.items.flatMap((item, i) => {
      const cy = top + row * (i + 0.5);
      const bx = left + bullet / 2;
      const text = Inks.text([item], [HandFont.width(item, size)], left + bullet * 1.6, cy - (size * HandFont.LEADING) / 2, size, "regular", this.ink(), "start");
      return [this.bullet(piece.style, i, bx, cy, bullet), text];
    });
  }

  private bullet(style: WbPieceOf<"list">["style"], i: number, cx: number, cy: number, s: number): InkDraft {
    const rng = this.rng(`bullet${i}`);
    switch (style) {
      case "check":
        return Inks.line(Rough.check(cx, cy, s), this.pen * 1.3, this.ink("green"), this.speed);
      case "cross":
        return Inks.line(Rough.cross(cx, cy, s * 0.7, s * 0.7, rng), this.pen * 1.3, this.ink("red"), this.speed);
      case "number": {
        const label = `${i + 1}.`;
        return Inks.text([label], [HandFont.width(label, s * 1.1, "bold")], cx, cy - (s * 1.1 * HandFont.LEADING) / 2, s * 1.1, "bold", this.ink("blue"));
      }
      default:
        return Inks.fill(PieceInk.oval(cx, cy, s * 0.16, s * 0.16), this.ink(), 1, 0.12);
    }
  }

  private item(id: string): InkDraft[] {
    const spot = this.ctx.spots.get(id);
    if (!spot) return [];
    const { palette, pictures, unit } = this.ctx;
    const color = this.ink(spot.item.ink);
    const glyph = GlyphInk.find(spot.item.picture, pictures);
    const out: InkDraft[] = [];
    if (!glyph?.logo)
      out.push(Inks.fill(PieceInk.oval(spot.cx, spot.cy, spot.icon * 0.6, spot.icon * 0.56), palette.washes[spot.order % palette.washes.length], 1, 0.22));
    if (glyph) {
      const s = spot.icon / Math.max(glyph.w, glyph.h);
      const place = { x: spot.cx - (glyph.w * s) / 2, y: spot.cy - (glyph.h * s) / 2, s };
      const world = Inks.clamp(spot.icon * 0.045, unit * 0.0045, unit * 0.011);
      const paint = (fill: string) => (fill === "ink" ? color : fill);
      if (glyph.logo) {
        glyph.parts.forEach((part, i) => {
          if (part.fill) out.push({ ...Inks.fill(part.d, paint(part.fill), 1, 0.5, place, part.evenodd), with: i > 0 });
        });
      } else {
        for (const part of glyph.parts) {
          const width = part.width ?? (glyph.kit ? world : world * 0.6) / s;
          out.push(Inks.glyphLine(part.d, PathInk.flatten(part.d), width, color, place, this.speed * 0.7));
        }
        glyph.parts
          .filter((part) => part.fill)
          .forEach((part, i) => out.push({ ...Inks.fill(part.d, paint(part.fill as string), 1, 0.3, place, part.evenodd), with: i > 0 }));
      }
    } else {
      out.push(Inks.line([Rough.ellipse(spot.cx, spot.cy, spot.icon * 0.42, spot.icon * 0.42, this.rng(`ring${id}`))], this.pen, color, this.speed));
      const letter = spot.item.label.charAt(0).toUpperCase();
      const size = spot.icon * 0.5;
      out.push(Inks.text([letter], [HandFont.width(letter, size, "bold")], spot.cx, spot.cy - (size * HandFont.LEADING) / 2, size, "bold", color));
    }
    const { label } = spot;
    out.push(Inks.text(label.lines, label.widths, spot.cx, label.top, label.size, "regular", this.ink()));
    return out;
  }

  private arrow(from: string, to: string, color: string, head = true): { drafts: InkDraft[]; body: Point[] } | null {
    const a = this.ctx.spots.get(from);
    const b = this.ctx.spots.get(to);
    if (!a || !b) return null;
    const pad = this.ctx.unit * 0.022;
    const ca: Point = [a.box.x + a.box.w / 2, a.box.y + a.box.h / 2];
    const cb: Point = [b.box.x + b.box.w / 2, b.box.y + b.box.h / 2];
    let start = PieceInk.exit(a.box, ca, cb, pad);
    let end = PieceInk.exit(b.box, cb, ca, pad);
    const back = this.ctx.arrows.has(`${to}>${from}`);
    if (back) {
      const len = Math.hypot(end[0] - start[0], end[1] - start[1]) || 1;
      const nx = (-(end[1] - start[1]) / len) * pad * 1.6;
      const ny = ((end[0] - start[0]) / len) * pad * 1.6;
      start = [start[0] + nx, start[1] + ny];
      end = [end[0] + nx, end[1] + ny];
    }
    const [body, wings] = Rough.arrow(start, end, this.rng(`${from}>${to}`), this.ctx.unit * 0.026, back ? 0.02 : 0.06);
    this.ctx.arrows.set(`${from}>${to}`, body);
    const drafts = [Inks.line([body], this.pen, color, this.speed * 1.2)];
    if (head) drafts.push(Inks.line([wings], this.pen, color, this.speed));
    return { drafts, body };
  }

  private label(body: Point[], text: string, color: string): InkDraft {
    const size = this.ctx.unit * 0.034;
    const mid = body[Math.floor(body.length / 2)];
    const first = body[0];
    const last = body[body.length - 1];
    const upright = Math.abs(last[1] - first[1]) > Math.abs(last[0] - first[0]);
    const width = HandFont.width(text, size);
    const x = upright ? mid[0] + width / 2 + size * 0.5 : mid[0];
    const y = upright ? mid[1] - (size * HandFont.LEADING) / 2 : mid[1] - size * 1.5;
    return Inks.text([text], [width], x, y, size, "regular", color);
  }

  private link(from: string, to: string, label: string | undefined, ink: WbInk): InkDraft[] {
    const made = this.arrow(from, to, this.ink(ink));
    if (!made) return [];
    return label ? [...made.drafts, this.label(made.body, label, this.ink(ink))] : made.drafts;
  }

  private flow(piece: WbPieceOf<"flow">): InkDraft[] {
    const out: InkDraft[] = [];
    const route: Point[] = [];
    for (let i = 1; i < piece.path.length; i++) {
      const key = `${piece.path[i - 1]}>${piece.path[i]}`;
      let body = this.ctx.arrows.get(key);
      if (!body) {
        const made = this.arrow(piece.path[i - 1], piece.path[i], this.ink());
        if (!made) continue;
        out.push(...made.drafts);
        body = made.body;
      }
      route.push(...body);
    }
    if (route.length < 2) return out;
    const hops = piece.path.length - 1;
    const size = this.ctx.unit * 0.036;
    const label = piece.label ? { text: piece.label, size, width: HandFont.width(piece.label, size, "bold") } : undefined;
    out.push({ kind: "dot", path: new Polyline([route]), r: this.ctx.unit * 0.018, color: this.ink("red"), halo: this.ctx.palette.board, label, cost: Inks.clamp(hops * 0.9, 1.1, 3) });
    return out;
  }

  private union(ids: readonly string[]): Box | null {
    const boxes = ids.map((id) => this.ctx.spots.get(id)?.box).filter((box): box is Box => !!box);
    if (!boxes.length) return null;
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return {
      x,
      y,
      w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
      h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
    };
  }

  private circle(piece: WbPieceOf<"circle">): InkDraft[] {
    const box = this.union(piece.ids);
    if (!box) return [];
    const color = this.ink(WbPalettes.tone(piece.tone));
    const pad = this.ctx.unit * 0.03;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const rx = box.w * 0.62 + pad;
    const ry = box.h * 0.6 + pad;
    const out = [Inks.line([Rough.ellipse(cx, cy, rx, ry, this.rng(`circle${piece.ids.join()}`))], this.pen * 1.25, color, this.speed * 1.4)];
    if (piece.label) {
      const size = this.ctx.unit * 0.038;
      out.push(Inks.text([piece.label], [HandFont.width(piece.label, size, "bold")], cx, cy - ry - size * 1.75, size, "bold", color));
    }
    return out;
  }

  private cross(piece: WbPieceOf<"cross">): InkDraft[] {
    const color = this.ink("red");
    const out: InkDraft[] = [];
    for (const id of piece.ids) {
      const spot = this.ctx.spots.get(id);
      if (!spot) continue;
      const b = spot.box;
      out.push(Inks.line(Rough.cross(b.x + b.w / 2, b.y + b.h / 2, b.w * 0.9, b.h * 0.85, this.rng(`x${id}`)), this.pen * 1.5, color, this.speed * 1.3));
    }
    const box = this.union(piece.ids);
    if (piece.label && box) {
      const size = this.ctx.unit * 0.038;
      out.push(Inks.text([piece.label], [HandFont.width(piece.label, size, "bold")], box.x + box.w / 2, box.y + box.h + size * 0.3, size, "bold", color));
    }
    return out;
  }

  private number(piece: WbPieceOf<"number">, box: Box): InkDraft[] {
    const { unit } = this.ctx;
    const decimals = piece.decimals ?? 0;
    const prefix = piece.prefix ?? "";
    const suffix = piece.suffix ?? "";
    const shown = `${prefix}${piece.to.toFixed(decimals)}${suffix}`;
    const big = HandFont.fit(shown, { w: box.w, h: box.h * 0.6 }, unit * 0.17, "bold", 1);
    const label = HandFont.fit(piece.label, { w: box.w, h: box.h * 0.32 }, unit * 0.048, "regular", 2);
    const total = big.height + label.height;
    const top = box.y + (box.h - total) / 2;
    const cx = box.x + box.w / 2;
    const count: InkDraft = {
      ...Inks.text([shown], [big.width], cx, top, big.size, "bold", this.ink("blue")),
      kind: "text",
      count: { from: piece.from ?? 0, to: piece.to, decimals, prefix, suffix },
      cost: 1.1,
    } as InkDraft;
    return [count, Inks.text(label.lines, label.lines.map((l) => HandFont.width(l, label.size)), cx, top + big.height, label.size, "regular", this.ink())];
  }

  private bars(piece: WbPieceOf<"bars">, box: Box): InkDraft[] {
    const { unit } = this.ctx;
    const size = Math.min(unit * 0.036, box.h * 0.09);
    const base = box.y + box.h - size * 1.6;
    const top = box.y + size * 1.6;
    const n = piece.items.length;
    const slot = box.w / n;
    const most = Math.max(...piece.items.map((item) => item.value), 1e-9);
    const rng = this.rng("bars");
    const out: InkDraft[] = [Inks.line([Rough.line([box.x, base], [box.x + box.w, base], rng, 0.004)], this.pen, this.ink(), this.speed * 1.6)];
    piece.items.forEach((item, i) => {
      const color = this.ink(item.ink ?? (["blue", "orange", "green", "red"] as const)[i % 4]);
      const w = slot * 0.52;
      const x = box.x + slot * i + (slot - w) / 2;
      const h = Math.max(unit * 0.01, ((base - top) * item.value) / most);
      out.push(Inks.line([Rough.box(x, base - h, w, h, this.rng(`bar${i}`))], this.pen, color, this.speed * 1.4));
      out.push({ ...Inks.fill(`M${x} ${base - h}h${w}v${h}h${-w}Z`, color, 0.28, 0.25), with: false });
      const value = `${PieceInk.short(item.value)}${piece.unit ?? ""}`;
      out.push(Inks.text([value], [HandFont.width(value, size, "bold")], x + w / 2, base - h - size * 1.3, size, "bold", color));
      const label = HandFont.fit(item.label, { w: slot * 0.95, h: size * 1.3 }, size, "regular", 1);
      out.push(Inks.text(label.lines, label.lines.map((l) => HandFont.width(l, label.size)), x + w / 2, base + size * 0.2, label.size, "regular", this.ink()));
    });
    return out;
  }

  private compare(piece: WbPieceOf<"compare">, box: Box): InkDraft[] {
    const { unit } = this.ctx;
    const out: InkDraft[] = [];
    const mid = box.x + box.w / 2;
    const most = Math.max(piece.left.items.length, piece.right.items.length);
    const used = Math.min(box.h, box.h * 0.26 + most * unit * 0.11);
    const top = box.y + (box.h - used) / 2;
    box = { ...box, y: top, h: used };
    out.push(Inks.line([Rough.line([mid, box.y], [mid, box.y + box.h], this.rng("divider"), 0.01)], this.pen, this.ink(), this.speed * 1.6));
    const half = box.w / 2;
    (["left", "right"] as const).forEach((sideKey) => {
      const side = piece[sideKey];
      const x = sideKey === "left" ? box.x : mid;
      const cx = x + half / 2;
      const head = HandFont.fit(side.title, { w: half * 0.86, h: unit * 0.09 }, unit * 0.056, "bold", 1);
      const color = piece.winner === sideKey ? this.ink("green") : piece.winner ? this.ink("red") : this.ink("blue");
      out.push(Inks.text(head.lines, [head.width], cx, box.y, head.size, "bold", color));
      const lineY = box.y + head.height + head.size * 0.05;
      out.push(Inks.line([Rough.underline(cx - head.width / 2, lineY, head.width, this.rng(`u${sideKey}`))], this.pen, color, this.speed * 1.6));
      const rowTop = lineY + head.size * 0.4;
      const row = Math.min((box.y + box.h - rowTop) / side.items.length, unit * 0.1);
      side.items.forEach((item) => {
        const fit = HandFont.fit(item, { w: half * 0.88, h: row * 0.9 }, Math.min(row * 0.55, unit * 0.044), "regular", 2);
        const i = side.items.indexOf(item);
        out.push(Inks.text(fit.lines, fit.lines.map((l) => HandFont.width(l, fit.size)), cx, rowTop + row * i + (row - fit.height) / 2, fit.size, "regular", this.ink()));
      });
      if (piece.winner === sideKey) {
        out.push(Inks.line([Rough.ellipse(cx, box.y + head.height / 2, head.width * 0.62 + unit * 0.02, head.height * 0.62 + unit * 0.01, this.rng("winner"))], this.pen * 1.2, color, this.speed * 1.4));
      }
    });
    return out;
  }

  private formula(piece: WbPieceOf<"formula">, box: Box): InkDraft[] {
    const { unit } = this.ctx;
    const inner = { x: box.x + box.w * 0.08, y: box.y + box.h * 0.14, w: box.w * 0.84, h: box.h * 0.72 };
    const words = this.words(piece.text, inner, unit * 0.078, "bold", this.ink(), 2);
    const pad = words.size * 0.35;
    const cx = box.x + box.w / 2;
    const cy = inner.y + inner.h / 2;
    const w = words.width + pad * 2;
    const h = words.height + pad * 1.4;
    return [words.draft, Inks.line([Rough.box(cx - w / 2, cy - h / 2, w, h, this.rng("formula"))], this.pen, this.ink("blue"), this.speed * 1.6)];
  }

  static exit(box: Box, from: Point, toward: Point, pad: number): Point {
    const x0 = box.x - pad;
    const y0 = box.y - pad;
    const x1 = box.x + box.w + pad;
    const y1 = box.y + box.h + pad;
    const dx = toward[0] - from[0];
    const dy = toward[1] - from[1];
    const tx = dx > 0 ? (x1 - from[0]) / dx : dx < 0 ? (x0 - from[0]) / dx : Infinity;
    const ty = dy > 0 ? (y1 - from[1]) / dy : dy < 0 ? (y0 - from[1]) / dy : Infinity;
    const t = Math.min(tx, ty, 1);
    return [from[0] + dx * t, from[1] + dy * t];
  }

  static oval(cx: number, cy: number, rx: number, ry: number): string {
    return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
  }

  static short(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
}
