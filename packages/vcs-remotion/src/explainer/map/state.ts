import type { MarkTone } from "../diagram/spec.ts";
import { type Beat, type Board, PIECE_KINDS, type Piece } from "../spec.ts";
import type { MapRegion, RouteMode } from "./spec.ts";

export interface MapRoute {
  from: string;
  to: string;
  /** Places it passes on the way, so a ship rounds a cape instead of crossing land. */
  via: string[];
  mode: RouteMode;
  label?: string;
}

export interface MapZone {
  tone: MarkTone;
  label?: string;
}

/** The map once some beats have run: the region asked for, the places pinned, the routes
 *  drawn and the countries filled. A board's map starts from what earlier scenes left. */
export interface MapShape {
  region: MapRegion | null;
  pins: string[];
  routes: MapRoute[];
  zones: Map<string, MapZone>;
}

export class MapMemory {
  static empty(): MapShape {
    return { region: null, pins: [], routes: [], zones: new Map() };
  }

  static isMap(board: Board): boolean {
    return board.beats.some((beat) => PIECE_KINDS[beat.piece.type].layer === "map");
  }

  static before(history: readonly Board[]): MapShape {
    const shape = MapMemory.empty();
    for (const board of history) for (const beat of board.beats) MapMemory.apply(shape, beat.piece);
    return shape;
  }

  static apply(shape: MapShape, piece: Piece): void {
    switch (piece.type) {
      case "map":
        shape.region = piece.region;
        return;
      case "pin":
        for (const id of piece.places) if (!shape.pins.includes(id)) shape.pins.push(id);
        return;
      case "route":
        for (const id of [piece.from, piece.to]) if (!shape.pins.includes(id)) shape.pins.push(id);
        shape.routes.push({
          from: piece.from,
          to: piece.to,
          via: piece.via ?? [],
          mode: piece.mode ?? "plane",
          label: piece.label,
        });
        return;
      case "zone":
        piece.countries.forEach((code, k) =>
          shape.zones.set(code, {
            tone: piece.tone ?? "focus",
            label: k ? undefined : piece.label,
          }),
        );
        return;
      default:
        return;
    }
  }
}

export interface Timed {
  /** When it comes on in this scene (null: on from the start). */
  at: number | null;
}

/** One scene's map as times: the region changes, the pins dropping, the routes travelling
 *  and the countries filling. */
export class MapScript {
  static readonly TRAVEL = 2.2;

  readonly regions: (Timed & { region: MapRegion | null })[] = [];
  readonly pins: (Timed & { id: string })[] = [];
  readonly routes: (Timed & MapRoute & { seconds: number })[] = [];
  readonly zones: (Timed & MapZone & { code: string })[] = [];
  readonly shape: MapShape;

  constructor(start: MapShape, beats: readonly Beat[], starts: readonly number[], seconds: number) {
    this.shape = {
      ...start,
      pins: [...start.pins],
      routes: [...start.routes],
      zones: new Map(start.zones),
    };
    this.regions.push({ region: start.region, at: null });
    for (const id of start.pins) this.pins.push({ id, at: null });
    for (const route of start.routes) this.routes.push({ ...route, at: null, seconds: 0 });
    for (const [code, zone] of start.zones) this.zones.push({ code, ...zone, at: null });
    beats.forEach((beat, i) =>
      this.play(beat.piece, starts[i], (starts[i + 1] ?? seconds) - starts[i]),
    );
  }

  private play(piece: Piece, at: number, span: number): void {
    if (PIECE_KINDS[piece.type].layer !== "map") return;
    MapMemory.apply(this.shape, piece);
    switch (piece.type) {
      case "map":
        this.regions.push({ region: piece.region, at });
        return;
      case "pin":
        piece.places.forEach((id, k) => this.pin(id, at + k * Math.min(0.4, span / 4)));
        return;
      case "route": {
        const seconds = Math.min(MapScript.TRAVEL, Math.max(1, span * 0.8));
        this.pin(piece.from, at);
        this.pin(piece.to, at + seconds);
        this.routes.push({
          from: piece.from,
          to: piece.to,
          via: piece.via ?? [],
          mode: piece.mode ?? "plane",
          label: piece.label,
          at: at + 0.1,
          seconds,
        });
        return;
      }
      case "zone":
        piece.countries.forEach((code, k) =>
          this.zones.push({
            code,
            tone: piece.tone ?? "focus",
            label: k ? undefined : piece.label,
            at: at + k * 0.12,
          }),
        );
        return;
      default:
        return;
    }
  }

  private pin(id: string, at: number): void {
    if (!this.pins.some((pin) => pin.id === id)) this.pins.push({ id, at });
  }
}
