import type { MarkTone } from "../diagram/spec.ts";
import { type Beat, type Board, PIECE_KINDS } from "../spec.ts";
import type { CodeFile } from "./spec.ts";

/** Lines found by text a writer copied from them: case and spacing do not count. Lines
 *  already written come first, so a text that repeats points at the lines on screen. */
export class LineMatch {
  /** The lines that hold each text: every one written so far (`shown`), else the first. */
  static all(lines: readonly string[], texts: readonly string[], shown: number): number[] {
    const out = new Set<number>();
    for (const text of texts) {
      const hits = LineMatch.hits(lines, text);
      const written = hits.filter((at) => at < shown);
      for (const at of written.length ? written : hits.slice(0, 1)) out.add(at);
    }
    return [...out].sort((a, b) => a - b);
  }

  /** How many lines show once a beat asks for the file through a line: up to its next
   *  match past `shown`, all of them when it names none or none is found. */
  static through(file: CodeFile, text: string | undefined, shown: number): number {
    const hits = text ? LineMatch.hits(file.lines, text) : [];
    if (!hits.length) return file.lines.length;
    return (hits.find((at) => at >= shown) ?? hits[0]) + 1;
  }

  private static hits(lines: readonly string[], text: string): number[] {
    const wanted = LineMatch.normal(text);
    if (!wanted) return [];
    return lines.flatMap((line, at) => (LineMatch.normal(line).includes(wanted) ? [at] : []));
  }

  private static normal(text: string): string {
    return text.toLowerCase().replace(/\s+/g, " ").trim();
  }
}

export interface CodeShape {
  open: string | null;
  shown: Map<string, number>;
}

/** The editor once some beats have run: the file open and how far each file is written. A
 *  board's editor starts where earlier scenes left it. */
export class CodeMemory {
  private open: string | null = null;
  private readonly shown = new Map<string, number>();

  constructor(private readonly files: ReadonlyMap<string, CodeFile>) {}

  static before(history: readonly Board[], files: ReadonlyMap<string, CodeFile>): CodeShape {
    const memory = new CodeMemory(files);
    for (const board of history) for (const beat of board.beats) memory.apply(beat);
    return { open: memory.open, shown: new Map(memory.shown) };
  }

  static isCode(board: Board): boolean {
    return board.beats.some((beat) => PIECE_KINDS[beat.piece.type].layer === "code");
  }

  apply(beat: Beat): void {
    const piece = beat.piece;
    if (piece.type === "code") {
      const file = this.files.get(piece.file);
      if (!file) return;
      this.open = file.id;
      this.reveal(file.id, LineMatch.through(file, piece.through, this.shown.get(file.id) ?? 0));
    } else if (piece.type === "focus" && this.open) {
      const file = this.files.get(this.open);
      const shown = this.shown.get(this.open) ?? 0;
      const lines = file ? LineMatch.all(file.lines, piece.lines, shown) : [];
      if (lines.length) this.reveal(this.open, (lines.at(-1) as number) + 1);
    }
  }

  private reveal(id: string, count: number): void {
    this.shown.set(id, Math.max(this.shown.get(id) ?? 0, count));
  }
}

/** Lines `from` up to `to` typed in from `at`, at `rate` characters a second. */
export interface Typing {
  from: number;
  to: number;
  at: number;
  rate: number;
}

/** Lines lit with a tone from `at` until `until`, the others dimmed. */
export interface Lit {
  lines: number[];
  tone: MarkTone;
  label?: string;
  at: number;
  until: number;
}

/** One file on screen during a scene: from `at` (null: from the start) until `until`, with
 *  `base` lines already written when it opens. */
export interface Sheet {
  file: CodeFile;
  at: number | null;
  until: number;
  base: number;
  typing: Typing[];
  lit: Lit[];
}

/** One scene's editor as times: the files it opens, the lines typed in and the lines lit. */
export class CodeScript {
  static readonly OPEN = 0.35;

  readonly sheets: Sheet[] = [];
  private readonly shown: Map<string, number>;

  constructor(
    start: CodeShape,
    private readonly files: ReadonlyMap<string, CodeFile>,
    beats: readonly Beat[],
    starts: readonly number[],
    private readonly seconds: number,
  ) {
    this.shown = new Map(start.shown);
    const open = start.open ? files.get(start.open) : undefined;
    if (open) this.open(open, null);
    beats.forEach((beat, i) => this.play(beat, starts[i], (starts[i + 1] ?? seconds) - starts[i]));
  }

  private play(beat: Beat, at: number, span: number): void {
    const piece = beat.piece;
    if (piece.type === "code") {
      const file = this.files.get(piece.file);
      if (!file) return;
      let sheet = this.sheets.at(-1);
      const opened = sheet?.file.id !== file.id;
      if (!sheet || opened) sheet = this.open(file, at);
      this.unlight(sheet, at);
      this.type(
        sheet,
        LineMatch.through(file, piece.through, this.shown.get(file.id) ?? 0),
        at + (opened ? CodeScript.OPEN : 0.1),
        span,
      );
      return;
    }
    if (piece.type !== "focus") return;
    const sheet = this.sheets.at(-1);
    if (!sheet) return;
    const shown = this.shown.get(sheet.file.id) ?? 0;
    const lines = LineMatch.all(sheet.file.lines, piece.lines, shown);
    if (!lines.length) return;
    this.type(sheet, (lines.at(-1) as number) + 1, at, Math.min(span, 0.8));
    this.unlight(sheet, at);
    sheet.lit.push({
      lines,
      tone: piece.tone ?? "focus",
      label: piece.label,
      at: at + 0.1,
      until: this.seconds,
    });
  }

  private open(file: CodeFile, at: number | null): Sheet {
    const last = this.sheets.at(-1);
    if (last && at != null) last.until = at;
    const sheet: Sheet = {
      file,
      at,
      until: this.seconds,
      base: this.shown.get(file.id) ?? 0,
      typing: [],
      lit: [],
    };
    this.sheets.push(sheet);
    return sheet;
  }

  private type(sheet: Sheet, count: number, at: number, span: number): void {
    const have = this.shown.get(sheet.file.id) ?? 0;
    if (count <= have) return;
    const chars = sheet.file.lines
      .slice(have, count)
      .reduce((sum, line) => sum + line.length + 4, 0);
    const rate = Math.max(36, chars / Math.max(0.6, span * 0.7));
    sheet.typing.push({ from: have, to: count, at, rate });
    this.shown.set(sheet.file.id, count);
  }

  private unlight(sheet: Sheet, at: number): void {
    for (const lit of sheet.lit) if (lit.until > at) lit.until = at;
  }
}
