import fs from "node:fs";
import path from "node:path";
import {
  CAPTIONED_COMPOSITION_ID,
  CaptionPlacement,
  type Caption,
  type CaptionWord,
  EditDocs,
  STORY_COMPOSITION_ID,
  type StoryVideoProps,
} from "@vcs/remotion";
import { type RenderJob, RenderTags } from "./driver.ts";
import { type Flow, type FlowStep, FlowSteps, type Later } from "./queue/queue.ts";
import type { Route, Spec, WorkDir } from "./queue/work.ts";

export interface Composed {
  compositionId: string;
  inputProps: Record<string, unknown>;
}

export interface CaptionBody {
  clipRel: string;
  width: number;
  height: number;
  fps: number;
  inSec: number;
  durationSec: number;
  captions?: Caption[];
  out?: string;
  out_dir?: string;
  uploadUrl?: string;
  callbackUrl?: string;
}

export interface StoryScene {
  image: string;
  images?: string[];
  video?: string;
  video_seconds?: number;
  video_audio?: boolean;
  flat?: boolean;
  audio?: string;
  seconds: number;
  words?: CaptionWord[];
  index?: number;
  key?: string;
  render?: Composed;
}

export interface StoryBody {
  pid: string;
  width: number;
  height: number;
  fps: number;
  showCaptions?: boolean;
  karaoke?: boolean;
  captionColor?: string;
  captionScale?: number;
  captionPosition?: string;
  sceneGap?: number;
  reuseScenes?: boolean;
  music?: string;
  musicVolume?: number;
  musicUnderVoice?: number;
  out?: string;
  out_dir?: string;
  uploadUrl?: string;
  metadata?: Record<string, string>;
  endCard?: { image: string; seconds: number };
  callbackUrl?: string;
  renderId?: string;
  scenes: StoryScene[];
}

export interface RenderBody extends Composed {
  out?: string;
  out_dir?: string;
  uploadUrl?: string;
  metadata?: Record<string, string>;
}

export interface Target {
  dir: string;
  name: string;
  file: string;
}

export class Media {
  constructor(
    readonly port: number,
    readonly outputDir: string,
  ) {}

  url(rel: string): string {
    if (/^https?:\/\//i.test(rel)) return rel;
    const encoded = rel.split("/").map(encodeURIComponent).join("/");
    return `http://127.0.0.1:${this.port}/media/${encoded}`;
  }

  rel(file: string): string {
    return path.relative(this.outputDir, file).split(path.sep).join("/");
  }

  static segment(s: string): boolean {
    return !!s && !s.includes("..") && !s.includes("/") && !s.includes("\\");
  }

  relDir(s: string | undefined): boolean {
    if (!s || s.includes("..") || s.includes("\\") || path.isAbsolute(s)) return false;
    const resolved = path.resolve(this.outputDir, s);
    return resolved === this.outputDir || resolved.startsWith(this.outputDir + path.sep);
  }
}

export class RenderSpecs {
  static readonly PREWARM_PRIORITY = -10;
  static readonly OUT_DIR = "renders";
  static readonly PREWARM_DELAY_MS = (Number(process.env.PREWARM_DELAY_SECONDS) || 60) * 1000;

  constructor(readonly media: Media) {}

  problem(route: Route, body: unknown): string {
    const b = body as Record<string, unknown> | null;
    if (!b || typeof b !== "object") return "Missing body";
    if (route === "story" || route === "prewarm") {
      if (!Media.segment(String(b.pid ?? ""))) return "Invalid pid";
      if (!Array.isArray(b.scenes) || b.scenes.length === 0) return "Missing scenes";
      for (const [i, scene] of (b.scenes as StoryScene[]).entries()) {
        const wrong = scene.render ? RenderSpecs.composed(scene.render) : "";
        if (wrong) return `scene ${i + 1}: ${wrong}`;
      }
      return "";
    }
    if (route === "caption") return b.clipRel ? "" : "Missing clipRel";
    return RenderSpecs.composed(b as unknown as Composed);
  }

  private static composed(c: Composed): string {
    if (!c.compositionId || typeof c.inputProps !== "object" || c.inputProps === null) {
      return "compositionId and inputProps are required";
    }
    try {
      EditDocs.parse(String(c.compositionId), c.inputProps);
      return "";
    } catch (e) {
      return String(e instanceof Error ? e.message : e);
    }
  }

  flow(spec: Spec): Flow {
    const meta = this.meta(spec);
    if (spec.route === "prewarm") {
      return { steps: FlowSteps.chain(["fetch", "prewarm", "finish"]), meta, priority: RenderSpecs.PREWARM_PRIORITY };
    }
    const fetch = FlowSteps.chain(["fetch"]);
    if (spec.route !== "story") return { steps: FlowSteps.chain([spec.route, "upload", "finish"], fetch), meta };
    const scenes = (spec.body as unknown as StoryBody).scenes;
    const boards: FlowStep[] = scenes.flatMap((s, part) =>
      s.render ? [{ name: `board-${part}`, kind: "board", after: ["fetch"], part }] : [],
    );
    return { steps: FlowSteps.chain(["story", "upload", "finish"], [...fetch, ...boards]), meta };
  }

  later(spec: Spec): Later | undefined {
    if (spec.route !== "prewarm") return undefined;
    return { key: `prewarm:${(spec.body as unknown as StoryBody).pid}`, delayMs: RenderSpecs.PREWARM_DELAY_MS };
  }

  private meta(spec: Spec): Record<string, string> {
    const b = spec.body;
    if (spec.route === "story" || spec.route === "prewarm") {
      const story = b as unknown as StoryBody;
      const seconds = story.scenes.reduce((sum, s) => sum + (Number(s.seconds) || 0), 0);
      const boards = story.scenes.filter((s) => s.render).length;
      return {
        route: spec.route,
        caller: story.pid,
        scenes: String(story.scenes.length),
        seconds: String(Math.round(seconds)),
        ...(boards ? { boards: String(boards) } : {}),
      };
    }
    if (spec.route === "caption") {
      const clip = b as unknown as CaptionBody;
      return {
        route: spec.route,
        caller: String(clip.out_dir ?? "renders").slice(0, 200),
        seconds: String(clip.durationSec),
      };
    }
    const render = b as unknown as RenderBody;
    return {
      route: spec.route,
      composition: render.compositionId,
      caller: String(render.out_dir ?? "renders").slice(0, 200),
      seconds: String(render.inputProps.seconds ?? ""),
    };
  }

  storyProps(b: StoryBody, work?: WorkDir): StoryVideoProps {
    const url = (rel: string) => this.media.url(rel);
    const drawn = (i: number) => (work ? url(this.media.rel(work.part(i))) : undefined);
    return {
      fps: b.fps,
      width: b.width,
      height: b.height,
      showCaptions: b.showCaptions !== false,
      karaoke: b.karaoke === true,
      captionColor: b.captionColor || undefined,
      captionScale: b.captionScale || undefined,
      captionPosition: CaptionPlacement.of(b.captionPosition),
      sceneGap: typeof b.sceneGap === "number" ? b.sceneGap : undefined,
      reuseScenes: b.reuseScenes !== false,
      music: b.music ? url(b.music) : undefined,
      musicVolume: typeof b.musicVolume === "number" ? b.musicVolume : undefined,
      musicUnderVoice: typeof b.musicUnderVoice === "number" ? b.musicUnderVoice : undefined,
      endCard:
        b.endCard?.image && b.endCard.seconds > 0
          ? { image: url(b.endCard.image), seconds: Math.min(b.endCard.seconds, 10) }
          : undefined,
      scenes: b.scenes.map((s, i) => ({
        image: s.image ? url(s.image) : "",
        images: Array.isArray(s.images) ? s.images.map(url) : undefined,
        video: s.video ? url(s.video) : s.render ? drawn(i) : undefined,
        video_seconds: s.video_seconds,
        video_audio: s.video_audio === true,
        flat: s.flat === true || undefined,
        audio: s.audio ? url(s.audio) : undefined,
        seconds: s.seconds,
        words: s.words || [],
        index: Number.isInteger(s.index) && s.index! >= 0 ? s.index : undefined,
        key: typeof s.key === "string" && s.key ? s.key : undefined,
      })),
    } as StoryVideoProps;
  }

  job(spec: Spec, work?: WorkDir): RenderJob {
    if (spec.route === "story" || spec.route === "prewarm") {
      const b = spec.body as unknown as StoryBody;
      const pinnedEntries =
        spec.route === "story" && work
          ? b.scenes.flatMap((_, i) => {
              const seg = work.segment(i);
              return fs.existsSync(seg) ? [[i, seg] as const] : [];
            })
          : [];
      return {
        compositionId: STORY_COMPOSITION_ID,
        inputProps: this.storyProps(b, work) as unknown as Record<string, unknown>,
        metadata: RenderTags.of(b.metadata),
        ...(pinnedEntries.length > 0 ? { pinnedSegments: Object.fromEntries(pinnedEntries) } : {}),
      };
    }
    if (spec.route === "caption") {
      const b = spec.body as unknown as CaptionBody;
      return {
        compositionId: CAPTIONED_COMPOSITION_ID,
        inputProps: {
          src: this.media.url(b.clipRel),
          fps: b.fps,
          width: b.width,
          height: b.height,
          inSec: b.inSec,
          durationSec: b.durationSec,
          captions: b.captions || [],
        },
      };
    }
    const b = spec.body as unknown as RenderBody;
    return { compositionId: b.compositionId, inputProps: b.inputProps, metadata: RenderTags.of(b.metadata) };
  }

  part(spec: Spec, part: number): RenderJob {
    const scene = (spec.body as unknown as StoryBody).scenes[part];
    if (!scene?.render) throw new Error(`scene ${part + 1} has nothing to render`);
    return { compositionId: scene.render.compositionId, inputProps: scene.render.inputProps };
  }

  target(spec: Spec, work: WorkDir): Target {
    const b = spec.body as { out?: string; out_dir?: string };
    const name = b.out && Media.segment(b.out) && b.out.endsWith(".mp4") ? b.out : `${work.id}.mp4`;
    const rel = this.media.relDir(b.out_dir) ? b.out_dir! : RenderSpecs.OUT_DIR;
    return { dir: path.join(this.media.outputDir, rel), name, file: `${rel}/${name}` };
  }
}
