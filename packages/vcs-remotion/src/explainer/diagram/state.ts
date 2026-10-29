import { Ease } from "../pieces/ease.ts";
import { type Beat, type Board, PIECE_KINDS } from "../spec.ts";
import type { DiagramLink, MarkTone } from "./spec.ts";

export interface DiagramShape {
  nodes: string[];
  links: DiagramLink[];
}

export class Links {
  static key(from: string, to: string): string {
    return `${from}>${to}`;
  }

  static hops(path: readonly string[]): DiagramLink[] {
    return path.slice(1).map((to, i) => ({ from: path[i], to }));
  }
}

/** What the diagram holds once some beats have run: the nodes shown and the arrows between
 *  them. A board's diagram starts from everything earlier scenes left on it. */
export class DiagramMemory {
  private readonly nodes: string[] = [];
  private readonly links = new Map<string, DiagramLink>();

  static before(history: readonly Board[]): DiagramShape {
    const memory = new DiagramMemory();
    for (const board of history) for (const beat of board.beats) memory.apply(beat);
    return memory.shape();
  }

  static isDiagram(board: Board): boolean {
    return board.beats.some((beat) => PIECE_KINDS[beat.piece.type].layer === "diagram");
  }

  apply(beat: Beat): void {
    const piece = beat.piece;
    switch (piece.type) {
      case "show":
        for (const id of piece.nodes ?? []) this.add(id);
        for (const link of piece.links ?? []) this.connect(link);
        return;
      case "flow":
        for (const link of Links.hops(piece.path)) this.connect(link);
        return;
      case "broadcast":
        for (const to of piece.to) this.connect({ from: piece.from, to });
        return;
      case "hide":
        this.drop(piece.all ? [...this.nodes] : (piece.nodes ?? []));
        for (const link of piece.links ?? []) this.links.delete(Links.key(link.from, link.to));
        return;
      default:
        return;
    }
  }

  shape(): DiagramShape {
    return { nodes: [...this.nodes], links: [...this.links.values()] };
  }

  private add(id: string): void {
    if (!this.nodes.includes(id)) this.nodes.push(id);
  }

  private connect(link: DiagramLink): void {
    if (link.from === link.to) return;
    this.add(link.from);
    this.add(link.to);
    const key = Links.key(link.from, link.to);
    const known = this.links.get(key);
    this.links.set(key, { ...link, label: link.label ?? known?.label });
  }

  private drop(ids: readonly string[]): void {
    for (const id of ids) {
      const at = this.nodes.indexOf(id);
      if (at >= 0) this.nodes.splice(at, 1);
    }
    for (const [key, link] of this.links) {
      if (ids.includes(link.from) || ids.includes(link.to)) this.links.delete(key);
    }
  }
}

/** When something is on the diagram during one scene: from `enter` (null: from the start)
 *  until `leave` (null: to the end). */
export interface Span {
  enter: number | null;
  leave: number | null;
}

export interface Trip {
  hops: DiagramLink[];
  at: number;
  hop: number;
  label?: string;
}

export interface Ring {
  node: string;
  tone: MarkTone;
  label?: string;
  at: number;
  until: number;
}

/** One scene's diagram as times: when each node and arrow comes and goes, the packets that
 *  travel and the rings that mark. Laid out over every node the scene ever shows, so nothing
 *  moves while the scene plays. */
export class DiagramScript {
  readonly nodes = new Map<string, Span>();
  readonly links = new Map<string, DiagramLink & Span>();
  readonly trips: Trip[] = [];
  readonly rings: Ring[] = [];

  constructor(
    readonly start: DiagramShape,
    beats: readonly Beat[],
    starts: readonly number[],
    readonly seconds: number,
  ) {
    for (const id of start.nodes) this.nodes.set(id, { enter: null, leave: null });
    for (const link of start.links) {
      this.links.set(Links.key(link.from, link.to), { ...link, enter: null, leave: null });
    }
    beats.forEach((beat, i) => {
      const at = starts[i];
      this.play(beat, at, (starts[i + 1] ?? seconds) - at);
    });
  }

  get order(): string[] {
    return [...this.nodes.keys()];
  }

  get arrows(): DiagramLink[] {
    return [...this.links.values()];
  }

  private play(beat: Beat, at: number, span: number): void {
    const piece = beat.piece;
    switch (piece.type) {
      case "show": {
        const nodes = piece.nodes ?? [];
        const links = piece.links ?? [];
        const count = nodes.length + links.length;
        nodes.forEach((id, k) => this.enter(id, at + Ease.stagger(k, count, span) - 0.2));
        links.forEach((link, k) => {
          const when = at + Ease.stagger(nodes.length + k, count, span) - 0.2;
          this.enter(link.from, when);
          this.enter(link.to, when);
          this.connect(link, when + 0.15);
        });
        return;
      }
      case "flow": {
        const hops = Links.hops(piece.path);
        const hop = Math.min(0.9, Math.max(0.35, (span * 0.75) / Math.max(1, hops.length)));
        piece.path.forEach((id, k) => this.enter(id, at + Math.max(0, k - 0.3) * hop));
        hops.forEach((link, k) => this.connect(link, at + k * hop));
        this.trips.push({ hops, at: at + 0.1, hop, label: piece.label });
        return;
      }
      case "broadcast": {
        const hop = Math.min(1, Math.max(0.45, span * 0.6));
        this.enter(piece.from, at);
        piece.to.forEach((to, k) => {
          this.enter(to, at);
          this.connect({ from: piece.from, to }, at);
          const label = k ? undefined : piece.label;
          this.trips.push({ hops: [{ from: piece.from, to }], at: at + 0.15, hop, label });
        });
        return;
      }
      case "mark":
        for (const node of piece.nodes) {
          this.enter(node, at);
          for (const ring of this.rings) {
            if (ring.node === node && ring.until > at) ring.until = at;
          }
          this.rings.push({ node, tone: piece.tone, label: piece.label, at, until: this.seconds });
        }
        return;
      case "hide": {
        const ids = piece.all ? this.order : (piece.nodes ?? []);
        ids.forEach((id, k) => this.leave(id, at + k * 0.08));
        for (const link of piece.links ?? []) {
          const known = this.links.get(Links.key(link.from, link.to));
          if (known && known.leave == null) known.leave = at;
        }
        return;
      }
      default:
        return;
    }
  }

  private enter(id: string, when: number): void {
    const span = this.nodes.get(id);
    if (!span) {
      this.nodes.set(id, { enter: Math.max(0, when), leave: null });
      return;
    }
    if (span.leave != null && span.leave <= when) span.leave = null;
  }

  private connect(link: DiagramLink, when: number): void {
    if (link.from === link.to) return;
    const key = Links.key(link.from, link.to);
    const known = this.links.get(key);
    if (!known) {
      this.links.set(key, { ...link, enter: Math.max(0, when), leave: null });
      return;
    }
    if (link.label && !known.label) known.label = link.label;
    if (known.leave != null && known.leave <= when) known.leave = null;
  }

  private leave(id: string, when: number): void {
    const span = this.nodes.get(id);
    if (span && span.leave == null) span.leave = when;
    for (const link of this.links.values()) {
      if ((link.from === id || link.to === id) && link.leave == null) link.leave = when;
    }
    for (const ring of this.rings) {
      if (ring.node === id && ring.until > when) ring.until = when;
    }
  }
}
