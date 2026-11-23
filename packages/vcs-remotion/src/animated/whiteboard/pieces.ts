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

interface Grid {
  frame: InkDraft[];
  cells: InkDraft[][];
  at: (r: number, c: number) => Point;
  w: number;
  cell: number;
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
      case "matrix":
        return this.matrix(piece, box);
      case "multiply":
        return this.multiply(piece, box);
      case "plot":
        return this.plot(piece, box);
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
    if (!a || !b || from === to) return null;
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

  private grid(cells: string[][], left: number, cy: number, cell: number, color: string, tag: string): Grid {
    const rows = cells.length;
    const cols = cells[0].length;
    const pad = cell * 0.22;
    const w = cols * cell + pad * 2;
    const h = rows * cell;
    const top = cy - h / 2;
    const widest = Math.max(...cells.flat().map((value) => HandFont.width(value, 1)));
    const size = Math.min(cell * 0.5, (cell * 0.84) / Math.max(widest, 1e-6));
    const at = (r: number, c: number): Point => [left + pad + cell * (c + 0.5), top + cell * (r + 0.5)];
    const lip = cell * 0.18;
    const side = (x: number, dir: number, key: string) => {
      const rng = this.rng(`${tag}${key}`);
      const end = top + h;
      return [[...Rough.line([x + dir * lip, top], [x, top], rng, 0.01), ...Rough.line([x, top], [x, end], rng, 0.01), ...Rough.line([x, end], [x + dir * lip, end], rng, 0.01)]];
    };
    const frame = [Inks.line(side(left, 1, "l"), this.pen * 1.2, this.ink(), this.speed * 1.6), Inks.line(side(left + w, -1, "r"), this.pen * 1.2, this.ink(), this.speed * 1.6)];
    const text = (r: number, c: number, value: string) => {
      const [x, y] = at(r, c);
      return Inks.text([value], [HandFont.width(value, size)], x, y - (size * HandFont.LEADING) / 2, size, "regular", color);
    };
    return { frame, cells: cells.map((row, r) => row.map((value, c) => text(r, c, value))), at, w, cell };
  }

  private band(grid: Grid, r0: number, c0: number, r1: number, c1: number, tag: string): Point[] {
    const inset = grid.cell * 0.06;
    const [x0, y0] = grid.at(r0, c0);
    const [x1, y1] = grid.at(r1, c1);
    const half = grid.cell / 2 - inset;
    return Rough.box(x0 - half, y0 - half, x1 - x0 + half * 2, y1 - y0 + half * 2, this.rng(tag));
  }

  private matrix(piece: WbPieceOf<"matrix">, box: Box): InkDraft[] {
    const { unit } = this.ctx;
    const cells = piece.cells.map((row) => row.map((value) => (typeof value === "number" ? PieceInk.short(value) : value)));
    const rows = cells.length;
    const cols = cells[0].length;
    const name = piece.name ? Math.min(unit * 0.05, box.h * 0.16) : 0;
    const head = name * HandFont.LEADING * 1.1;
    const cell = Math.min(unit * 0.13, (box.h - head) / rows, box.w / (cols + 0.6));
    const w = cols * cell + cell * 0.44;
    const total = head + rows * cell;
    const top = box.y + (box.h - total) / 2;
    const left = box.x + (box.w - w) / 2;
    const grid = this.grid(cells, left, top + head + (rows * cell) / 2, cell, this.ink(piece.ink), `m${piece.name ?? ""}`);
    const out: InkDraft[] = [];
    if (piece.name) out.push(Inks.text([piece.name], [HandFont.width(piece.name, name, "bold")], box.x + box.w / 2, top, name, "bold", this.ink("blue")));
    out.push(...grid.frame, ...grid.cells.flat());
    const tints = ["blue", "orange", "green", "red", "ink"] as const;
    if (piece.split === "rows")
      for (let r = 0; r < rows; r++) out.push(Inks.line([this.band(grid, r, 0, r, cols - 1, `row${r}`)], this.pen, this.ink(tints[r]), this.speed * 1.4));
    if (piece.split === "cols")
      for (let c = 0; c < cols; c++) out.push(Inks.line([this.band(grid, 0, c, rows - 1, c, `col${c}`)], this.pen, this.ink(tints[c]), this.speed * 1.4));
    if (piece.split === "diagonal") {
      const n = Math.min(rows, cols) - 1;
      const [x0, y0] = grid.at(0, 0);
      const [x1, y1] = grid.at(n, n);
      const angle = Math.atan2(y1 - y0, x1 - x0);
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const loop = Rough.ellipse(0, 0, Math.hypot(x1 - x0, y1 - y0) / 2 + cell * 0.45, cell * 0.4, this.rng("diagonal"));
      const turned = loop.map(([x, y]): Point => [cx + x * Math.cos(angle) - y * Math.sin(angle), cy + x * Math.sin(angle) + y * Math.cos(angle)]);
      out.push(Inks.line([turned], this.pen * 1.2, this.ink("orange"), this.speed * 1.4));
    }
    return out;
  }

  private multiply(piece: WbPieceOf<"multiply">, box: Box): InkDraft[] {
    const { unit } = this.ctx;
    const { a, b } = piece;
    const n = b.length;
    const product = a.map((row) => b[0].map((_, j) => row.reduce((sum, value, k) => sum + value * b[k][j], 0)));
    const show = (m: number[][]) => m.map((row) => row.map(PieceInk.short));
    const [ra, ca, cb] = [a.length, n, b[0].length];
    const work = piece.work ? 1.5 : 0;
    const sign = 0.9;
    const span = (cols: number) => cols + 0.44;
    const high = Math.max(ra, n);
    const flat = Math.min(unit * 0.12, box.w / (span(ca) + sign + span(cb) + sign + span(cb)), box.h / (high + work));
    const stacked = Math.min(unit * 0.12, box.w / Math.max(span(ca) + sign + span(cb), sign + span(cb)), box.h / (high + 0.4 + ra + work));
    const twoLines = stacked > flat * 1.15;
    const cell = twoLines ? stacked : flat;
    const used = (twoLines ? high + 0.4 + ra : high) * cell + work * cell;
    const top = box.y + (box.h - used) / 2;
    const line1 = top + (high * cell) / 2;
    const line2 = twoLines ? top + (high + 0.4) * cell + (ra * cell) / 2 : line1;
    const width1 = (span(ca) + sign + span(cb) + (twoLines ? 0 : sign + span(cb))) * cell;
    let x = box.x + (box.w - width1) / 2;
    const ga = this.grid(show(a), x, line1, cell, this.ink(), "ma");
    x += ga.w;
    const opSize = cell * 0.55;
    const op = (glyph: string, cx: number, cy: number) => Inks.text([glyph], [HandFont.width(glyph, opSize, "bold")], cx, cy - (opSize * HandFont.LEADING) / 2, opSize, "bold", this.ink("blue"));
    const times = op("×", x + (sign * cell) / 2, line1);
    x += sign * cell;
    const gb = this.grid(show(b), x, line1, cell, this.ink(), "mb");
    x += gb.w;
    if (twoLines) x = box.x + (box.w - (sign + span(cb)) * cell) / 2;
    const equals = op("=", x + (sign * cell) / 2, line2);
    x += sign * cell;
    const gc = this.grid(show(product), x, line2, cell, this.ink("green"), "mc");
    const out: InkDraft[] = [...ga.frame, ...ga.cells.flat(), times, ...gb.frame, ...gb.cells.flat(), equals, ...gc.frame];
    const lit = this.ink("orange");
    product.forEach((row, i) =>
      row.forEach((_, j) => {
        out.push({ ...Inks.line([this.band(ga, i, 0, i, ca - 1, `ra${i}${j}`)], this.pen, lit, this.speed * 1.8), brief: true });
        out.push({ ...Inks.line([this.band(gb, 0, j, n - 1, j, `cb${i}${j}`)], this.pen, lit, this.speed * 1.8), brief: true, with: true });
        if (piece.work && i === 0 && j === 0) {
          const sum = `${a[0].map((value, k) => `${PieceInk.short(value)}×${PieceInk.short(b[k][0])}`).join(" + ")} = ${PieceInk.short(product[0][0])}`;
          const fit = HandFont.fit(sum, { w: box.w, h: cell }, cell * 0.5, "regular", 1);
          out.push(Inks.text(fit.lines, [fit.width], box.x + box.w / 2, top + used - work * cell * 0.75, fit.size, "regular", lit));
        }
        out.push(gc.cells[i][j]);
      }),
    );
    return out;
  }

  private plot(piece: WbPieceOf<"plot">, box: Box): InkDraft[] {
    const { unit, palette } = this.ctx;
    const size = Math.min(unit * 0.032, box.h * 0.07);
    const flat = !piece.transform && (!piece.vectors || !!piece.curve);
    const matrix = piece.transform;
    const seen: Point[] = [...(piece.curve?.points ?? []).map(([x, y]): Point => [x, y])];
    for (const v of piece.vectors ?? []) seen.push([v.to[0], v.to[1]], [v.from?.[0] ?? 0, v.from?.[1] ?? 0]);
    if (matrix) {
      const [[a, b], [c, d]] = matrix;
      seen.push([1, 1], [-1, -1], [a + b, c + d], [a, c], [b, d], [a - b, c - d], [b - a, d - c]);
    }
    if (!flat) seen.push([0, 0]);
    const range = (axis: 0 | 1) => {
      const low = Math.min(...seen.map((p) => p[axis]));
      const high = Math.max(...seen.map((p) => p[axis]));
      const pad = Math.max(high - low, 1) * 0.12;
      return [low - pad, high + pad] as const;
    };
    const [x0, x1] = range(0);
    const [y0, y1] = range(1);
    const room = { x: box.x + size * 2.4, y: box.y + size * 1.8, w: box.w - size * 4.2, h: box.h - size * 3.8 };
    let sx = room.w / (x1 - x0);
    let sy = room.h / (y1 - y0);
    if (!flat) sx = sy = Math.min(sx, sy);
    else sx = Math.min(sx, (room.h * 1.7) / (x1 - x0));
    const left = room.x + (room.w - sx * (x1 - x0)) / 2;
    const bottom = room.y + (room.h + sy * (y1 - y0)) / 2;
    const at = ([x, y]: readonly number[]): Point => [left + (x - x0) * sx, bottom - (y - y0) * sy];
    const frame = { x: left, y: bottom - sy * (y1 - y0), w: sx * (x1 - x0), h: sy * (y1 - y0) };
    const out: InkDraft[] = [];
    const taken: Box[] = [];
    const ax = flat ? y0 : 0;
    const ay = flat ? x0 : 0;
    const stepX = PieceInk.step(x1 - x0);
    const stepY = PieceInk.step(y1 - y0);
    const ticks = (low: number, high: number, step: number) => {
      const out: number[] = [];
      for (let v = Math.ceil(low / step) * step; v <= high + 1e-9; v += step) out.push(Number(v.toFixed(6)));
      return out;
    };
    const xs = ticks(x0, x1, stepX);
    const ys = ticks(y0, y1, stepY);
    if (!flat) {
      const faint = palette.washes[1];
      const lines = [...xs.map((x): Point[] => [at([x, y0]), at([x, y1])]), ...ys.map((y): Point[] => [at([x0, y]), at([x1, y])])];
      out.push(Inks.line(lines, this.pen * 0.6, faint, this.speed * 4));
    }
    const head = unit * 0.022;
    const [bx, wx] = Rough.arrow(at([x0, ax]), at([x1, ax]), this.rng("xaxis"), head, 0);
    const [by, wy] = Rough.arrow(at([ay, y0]), at([ay, y1]), this.rng("yaxis"), head, 0);
    out.push(Inks.line([bx, wx], this.pen, this.ink(), this.speed * 1.6), Inks.line([by, wy], this.pen, this.ink(), this.speed * 1.6));
    const small = size * 0.78;
    const tick = size * 0.3;
    const marks: Point[][] = [];
    const numbers: InkDraft[] = [];
    for (const x of xs) {
      if (!flat && x === 0) continue;
      const [px, py] = at([x, ax]);
      marks.push([[px, py - tick], [px, py + tick]]);
      const label = PieceInk.short(x);
      const w = HandFont.width(label, small);
      taken.push({ x: px - w / 2, y: py + tick * 1.2, w, h: small * HandFont.LEADING });
      numbers.push(Inks.text([label], [w], px, py + tick * 1.2, small, "regular", this.ink()));
    }
    for (const y of ys) {
      if (!flat && y === 0) continue;
      const [px, py] = at([ay, y]);
      marks.push([[px - tick, py], [px + tick, py]]);
      const label = PieceInk.short(y);
      const w = HandFont.width(label, small);
      taken.push({ x: px - tick * 1.6 - w, y: py - (small * HandFont.LEADING) / 2, w, h: small * HandFont.LEADING });
      numbers.push(Inks.text([label], [w], px - tick * 1.6 - w / 2, py - (small * HandFont.LEADING) / 2, small, "regular", this.ink()));
    }
    if (marks.length) out.push(Inks.line(marks, this.pen * 0.8, this.ink(), this.speed * 4));
    out.push(...numbers.map((draft) => ({ ...draft, with: true })));
    if (piece.x) {
      const [px, py] = at([x1, ax]);
      const w = HandFont.width(piece.x, size, "bold");
      out.push(Inks.text([piece.x], [w], Math.min(px, box.x + box.w - w / 2), py + size * 0.9, size, "bold", this.ink("blue")));
    }
    if (piece.y) {
      const [px, py] = at([ay, y1]);
      out.push(Inks.text([piece.y], [HandFont.width(piece.y, size, "bold")], px + size * 0.6, py - size * 0.4, size, "bold", this.ink("blue"), "start"));
    }
    if (piece.curve) out.push(...this.curve(piece.curve, at, size));
    if (matrix) out.push(...this.transform(matrix, at, frame, x0, x1, y0, y1, size, taken));
    (piece.vectors ?? []).forEach((v, i) => {
      const color = this.ink(v.ink ?? (["blue", "orange", "green", "red"] as const)[i % 4]);
      out.push(...this.vector(at([v.from?.[0] ?? 0, v.from?.[1] ?? 0]), at(v.to), color, v.label ?? `(${v.to.map(PieceInk.short).join(", ")})`, size, `v${i}`, taken));
    });
    return out.map((draft) => (draft.kind === "text" ? { ...draft, halo: palette.board } : draft));
  }

  private curve(curve: NonNullable<WbPieceOf<"plot">["curve"]>, at: (p: readonly number[]) => Point, size: number): InkDraft[] {
    const color = this.ink(curve.ink ?? "blue");
    const smooth = PieceInk.smooth(curve.points.map(at));
    const out: InkDraft[] = [Inks.line([smooth], this.pen * 1.4, color, this.speed * 0.9)];
    if (curve.label) {
      const [ex, ey] = smooth[smooth.length - 1];
      const w = HandFont.width(curve.label, size, "bold");
      out.push(Inks.text([curve.label], [w], ex - w / 2 - size * 0.3, ey - size * 1.7, size, "bold", color));
    }
    if (curve.roll) {
      const low = smooth.reduce((best, p, i) => (p[1] > smooth[best][1] ? i : best), 0);
      const path = low > 0 ? smooth.slice(0, low + 1) : smooth.slice().reverse();
      const end = path[path.length - 1];
      const r = this.ctx.unit * 0.018;
      const lift = (p: Point): Point => [p[0], p[1] - r];
      out.push({ kind: "dot", path: new Polyline([path.map(lift)]), r, color: this.ink("red"), halo: this.ctx.palette.board, cost: 2 });
      out.push(Inks.fill(PieceInk.oval(end[0], end[1] - r, r, r), this.ink("red"), 1, 0.12));
    }
    return out;
  }

  private vector(from: Point, to: Point, color: string, label: string, size: number, tag: string, taken: Box[]): InkDraft[] {
    const [body, wings] = Rough.arrow(from, to, this.rng(tag), this.ctx.unit * 0.026, 0);
    const w = HandFont.width(label, size, "bold");
    const h = size * HandFont.LEADING;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    const bx = to[0] + (dx / len) * size * 0.9 + (dx >= 0 ? w / 2 : -w / 2) * 0.6;
    const by = to[1] + (dy / len) * size * 0.9 - size * 0.7;
    const spot = (k: number): Box => ({ x: bx - (dy / len) * k * h - w / 2, y: by + (dx / len) * k * h, w, h });
    const free = (box: Box) => taken.every((o) => box.x >= o.x + o.w || o.x >= box.x + box.w || box.y >= o.y + o.h || o.y >= box.y + box.h);
    const box = [0, 1, -1, 2, -2, 3, -3].map(spot).find(free) ?? spot(0);
    taken.push(box);
    const [x, y] = [box.x + w / 2, box.y];
    return [
      Inks.line([body], this.pen * 1.5, color, this.speed * 1.2),
      Inks.line([wings], this.pen * 1.5, color, this.speed),
      Inks.text([label], [w], x, y, size, "bold", color),
    ];
  }

  private transform(
    matrix: number[][],
    at: (p: readonly number[]) => Point,
    frame: Box,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    size: number,
    taken: Box[],
  ): InkDraft[] {
    const [[a, b], [c, d]] = matrix;
    const move = ([x, y]: readonly number[]): number[] => [a * x + b * y, c * x + d * y];
    const reach = Math.ceil(Math.max(Math.abs(x0), Math.abs(x1), Math.abs(y0), Math.abs(y1)) * 3);
    const lines: Point[][] = [];
    for (let k = -reach; k <= reach; k++) {
      for (const [p, q] of [
        [[k, -reach], [k, reach]],
        [[-reach, k], [reach, k]],
      ]) {
        const cut = PieceInk.clip(at(move(p)), at(move(q)), frame);
        if (cut) lines.push(cut);
      }
    }
    const out: InkDraft[] = [
      ...this.vector(at([0, 0]), at([1, 0]), this.ink(), "i", size, "i0", taken),
      ...this.vector(at([0, 0]), at([0, 1]), this.ink(), "j", size, "j0", taken),
    ];
    if (lines.length) out.push(Inks.line(lines, this.pen * 0.8, this.ink("blue"), this.speed * 3));
    out.push(...this.vector(at([0, 0]), at(move([1, 0])), this.ink("green"), `(${PieceInk.short(a)}, ${PieceInk.short(c)})`, size, "i1", taken));
    out.push(...this.vector(at([0, 0]), at(move([0, 1])), this.ink("red"), `(${PieceInk.short(b)}, ${PieceInk.short(d)})`, size, "j1", taken));
    return out;
  }

  static step(span: number): number {
    const raw = span / 6;
    const tens = 10 ** Math.floor(Math.log10(raw));
    const best = [1, 2, 5, 10].find((m) => m * tens >= raw) ?? 10;
    return best * tens;
  }

  static smooth(points: readonly Point[], steps = 10): Point[] {
    if (points.length < 3) return [...points];
    const out: Point[] = [points[0]];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        const axis = (k: 0 | 1) =>
          0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
        out.push([axis(0), axis(1)]);
      }
    }
    return out;
  }

  static clip(a: Point, b: Point, box: Box): Point[] | null {
    let t0 = 0;
    let t1 = 1;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const edges: [number, number][] = [
      [-dx, a[0] - box.x],
      [dx, box.x + box.w - a[0]],
      [-dy, a[1] - box.y],
      [dy, box.y + box.h - a[1]],
    ];
    for (const [p, q] of edges) {
      if (p === 0) {
        if (q < 0) return null;
        continue;
      }
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return null;
    }
    return [
      [a[0] + dx * t0, a[1] + dy * t0],
      [a[0] + dx * t1, a[1] + dy * t1],
    ];
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
