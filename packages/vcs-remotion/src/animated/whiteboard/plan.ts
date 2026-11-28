import type { CaptionWord } from "../../captions.ts";
import { type Panel, WbCamera } from "./camera.ts";
import type { Ink, InkDraft } from "./ink/ink.ts";
import type { Point } from "./ink/path.ts";
import { DiagramLayout, SceneLayout } from "./layout.ts";
import { PieceInk } from "./pieces.ts";
import type { WbBeat, WbFilm } from "./spec.ts";
import { WbPalettes } from "./theme.ts";

export interface WbPlan {
  panels: Panel[];
  inks: Ink[];
  seconds: number;
  voices: { start: number; end: number; src: string }[];
}

export class WbCues {
  static readonly LEAD = 0.12;

  static resolve(beats: readonly WbBeat[], words: readonly CaptionWord[], seconds: number): number[] {
    const tokens = words.map((word) => WbCues.normal(word.word));
    const found: (number | null)[] = [];
    let cursor = 0;
    for (const beat of beats) {
      const cue = (beat.cue ?? "").split(/\s+/).map(WbCues.normal).filter(Boolean);
      const at = WbCues.find(tokens, cue, cursor);
      found.push(at < 0 ? null : Math.max(0, words[at].start - WbCues.LEAD));
      if (at >= 0) cursor = at + 1;
    }
    const end = Math.max(0.5, seconds * 0.85);
    found[0] = found[0] ?? 0;
    for (let i = 1; i < found.length; i++) {
      if (found[i] != null) {
        found[i] = Math.max(found[i] as number, found[i - 1] as number);
        continue;
      }
      let next = i;
      while (next < found.length && found[next] == null) next++;
      const from = found[i - 1] as number;
      const to = next < found.length ? (found[next] as number) : end;
      found[i] = from + (Math.max(to, from) - from) / (next - i + 1);
    }
    return found as number[];
  }

  private static normal(word: string): string {
    return (word || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  }

  private static same(a: string, b: string): boolean {
    if (a === b) return true;
    return Math.min(a.length, b.length) >= 5 && Math.abs(a.length - b.length) <= 3 && (a.startsWith(b) || b.startsWith(a));
  }

  private static find(tokens: string[], cue: string[], from: number): number {
    if (!cue.length) return -1;
    for (let i = from; i + cue.length <= tokens.length; i++) if (cue.every((token, k) => WbCues.same(tokens[i + k], token))) return i;
    const anchor = cue.reduce((longest, token) => (token.length > longest.length ? token : longest));
    for (let i = from; i < tokens.length; i++) if (WbCues.same(tokens[i], anchor)) return i;
    return -1;
  }
}

export class WbPlanner {
  static readonly LEAST = 0.35;
  static readonly LINGER = 0.8;

  static plan(film: WbFilm): WbPlan {
    const { width: w, height: h } = film;
    const tall = h > w;
    const unit = Math.min(w, h);
    const palette = WbPalettes.of(film.theme);
    let clock = 0;
    const times = film.scenes.map((scene) => {
      const start = clock;
      clock += scene.seconds;
      return { start, end: clock };
    });
    const panels = WbCamera.panels(times, w, h);
    const inks: Ink[] = [];
    film.scenes.forEach((scene, i) => {
      const panel = panels[i];
      const area = SceneLayout.area(w, h, film.reserve);
      const shifted = { ...area, x: area.x + panel.x, y: area.y + panel.y };
      const blocks = SceneLayout.blocks(scene, shifted, tall);
      const diagram = blocks.get("diagram");
      const spots = diagram ? DiagramLayout.place(scene, diagram, tall, unit) : new Map();
      const drawer = new PieceInk({ unit, palette, pictures: film.pictures, spots, arrows: new Map<string, Point[]>(), key: `s${i}` });
      const cues = WbCues.resolve(scene.beats, scene.words, scene.seconds);
      const settle = panel.start + WbCamera.settle(i);
      const starts = cues.map((cue, b) => Math.max(settle, panel.start + (scene.beats[b].at ?? cue)));
      scene.beats.forEach((beat, b) => {
        const box = blocks.get(SceneLayout.key(scene, b));
        if (!box) return;
        const limit = (b + 1 < starts.length ? starts[b + 1] : panel.end - 0.25) - 0.06;
        inks.push(...WbPlanner.schedule(drawer.draw(beat.piece, box), starts[b], limit));
      });
    });
    return {
      panels,
      inks,
      seconds: clock + WbCamera.OUTRO,
      voices: film.scenes.flatMap((scene, i) => [
        ...(scene.voice ? [{ start: times[i].start, end: times[i].end, src: scene.voice }] : []),
        ...scene.beats.flatMap((beat) => (beat.voice ? [{ start: times[i].start + (beat.at ?? 0), end: times[i].end, src: beat.voice }] : [])),
      ]),
    };
  }

  static schedule(drafts: InkDraft[], start: number, limit: number): Ink[] {
    const natural = drafts.reduce((sum, draft) => sum + (draft.with ? 0 : draft.cost), 0);
    const room = Math.max(0.2, limit - start);
    const scale = natural > room ? Math.max(WbPlanner.LEAST, room / natural) : 1;
    let at = start;
    let last = start;
    const inks = drafts.map((draft) => {
      const { cost, with: together, brief: _, ...ink } = draft;
      const from = together ? last : at;
      const to = from + cost * scale;
      if (!together) at = to;
      last = from;
      return { ...ink, from, to } as Ink;
    });
    drafts.forEach((draft, i) => {
      if (!draft.brief) return;
      const next = drafts.findIndex((other, k) => k > i && other.brief && !other.with);
      inks[i].off = next > 0 ? inks[next].from : inks[i].to + WbPlanner.LINGER;
    });
    return inks;
  }
}
