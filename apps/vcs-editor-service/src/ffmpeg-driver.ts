import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  CLIP_COMPOSITION_ID,
  ClipGeometry,
  type ClipProps,
  EditDocs,
  type EndCard,
  MusicBed,
  ScenePause,
  STORY_COMPOSITION_ID,
  type StoryScene,
  type StoryVideoProps,
} from "@vcs/remotion";
import { AssCaptions } from "./ass-captions.ts";
import { type RenderDriver, type RenderJob, RenderTags } from "./driver.ts";
import type { SegmentCache } from "./segment-cache.ts";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
const evenFloor = (n: number) => Math.max(0, Math.floor(n / 2) * 2);

// Mirror the Remotion story composition's timing + grade so the fast lane stays a
// close visual match (not byte-identical — that is the parity contract's Remotion lane).
const DEFAULT_SCENE_GAP = 0.5;
// The finished mix is levelled to the short-form loudness target, as the voice already is.
const MASTER = "loudnorm=I=-14:TP=-1.5:LRA=11";
// Upscale the still before zoompan so the Ken Burns move samples from extra pixels
// instead of blurring; the upscaled frame is the whole canvas, so zoom 1 shows all of it.
const KB_UPSCALE = 2;
// How far a held last frame closes in over the rest of its scene.
const HOLD_ZOOM = 0.06;

// A stills scene's pictures hand over with the composition's crossfade.
const STILL_FADE_FRAMES = 12;
// The film look: darker edges, and a light grain on brightness only, as film has.
const VIGNETTE = "vignette=PI/5";
const GRAIN = "noise=c0s=7:c0f=t";
// The end card comes up from black and goes back to it.
const CARD_FADE_IN = 0.8;
const CARD_FADE_OUT = 1;

const sceneDurationSec = (scene: StoryScene, gap: number): number =>
  (scene.seconds || 1) + ScenePause.after(scene, gap);

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    proc.stderr.on("data", (d) => {
      err += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-400)}`)),
    );
  });
}

/** Whether the file has an audio stream: a clip from a model that makes no sound has none. */
async function hasAudio(file: string): Promise<boolean> {
  return (await probe(file, ["-select_streams", "a", "-show_entries", "stream=index"])) !== "";
}

/** ffprobe's answer for the file, trimmed. */
function probe(file: string, entries: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFPROBE, ["-v", "error", ...entries, "-of", "csv=p=0", file], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => {
      out += d.toString();
    });
    proc.stderr.on("data", (d) => {
      err += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0
        ? resolve(out.trim())
        : reject(new Error(`ffprobe exited ${code}: ${err.slice(-400)}`)),
    );
  });
}

/** A track shorter than the film repeats; its end crossfades into its start so no join is heard. */
class MusicLoop {
  private static readonly FADE = 2;

  /** The track itself when the film fits in it, else a wav made to repeat without a seam. */
  static async bed(music: string, length: number, work: string): Promise<string> {
    const seconds = Number(await probe(music, ["-show_entries", "format=duration"]));
    const fade = MusicLoop.FADE;
    if (!(seconds < length) || seconds < fade * 3) return music;
    const out = path.join(work, "bed.wav");
    await run(FFMPEG, [
      "-y",
      "-i",
      music,
      "-filter_complex",
      `[0:a]asplit=2[a][b];[a]atrim=start=${fade},asetpts=PTS-STARTPTS[body];` +
        `[b]atrim=end=${fade},asetpts=PTS-STARTPTS[head];[body][head]acrossfade=d=${fade}[m]`,
      "-map",
      "[m]",
      "-c:a",
      "pcm_s16le",
      "-ar",
      "48000",
      "-ac",
      "2",
      out,
    ]);
    return out;
  }
}

/**
 * Voice and music arrive at whatever level their engine made them, so both are brought to
 * one loudness before the bed's levels apply: a level then always means the same distance
 * under the voice.
 */
class Loudness {
  private static readonly STEM = -16;
  /** Quieter than this is silence, left alone rather than boosted. */
  private static readonly SILENT = -60;
  private static readonly MAX_GAIN = 20;

  /** dB that brings the file's audio to STEM, 0 when it is silent. */
  static async gain(file: string): Promise<number> {
    const lufs = await Loudness.integrated(file);
    if (lufs < Loudness.SILENT) return 0;
    return Math.max(-Loudness.MAX_GAIN, Math.min(Loudness.MAX_GAIN, Loudness.STEM - lufs));
  }

  private static integrated(file: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const args = [
        "-nostats",
        "-i",
        file,
        "-vn",
        "-af",
        "ebur128=framelog=verbose",
        "-f",
        "null",
        "-",
      ];
      const proc = spawn(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] });
      let err = "";
      proc.stderr.on("data", (d) => {
        err += d.toString();
      });
      proc.on("error", reject);
      proc.on("close", (code) => {
        const found = /Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/.exec(err);
        if (code === 0 && found) return resolve(Number(found[1]));
        reject(new Error(`loudness of ${file} failed (${code}): ${err.slice(-400)}`));
      });
    });
  }
}

/**
 * The fast render lane, no headless Chromium: a straight ffmpeg trim + crop/scale for a
 * clip (the composition's own crop math, ClipGeometry, so it is pixel-parity with the
 * Remotion Player preview), and the whole story assembly including its captions. A clip
 * with burned captions or rich layers routes to Remotion, see SmartDriver.
 */
export class FfmpegDriver implements RenderDriver {
  /** `segments` keeps rendered scenes by their content; `stamp` names the code drawing them. */
  constructor(
    private readonly segments?: SegmentCache,
    private readonly stamp = "",
  ) {}

  /** True only for a plain Clip cut with no burned captions (parity-safe for ffmpeg). */
  static supports(job: RenderJob): boolean {
    if (job.compositionId !== CLIP_COMPOSITION_ID) return false;
    const p = job.inputProps as Partial<ClipProps>;
    return !(p.showCaptions && (p.captions?.length ?? 0) > 0);
  }

  /** Every story: ffmpeg reproduces the Ken Burns + grain + vignette grade closely (not
   *  byte-identical) and burns captions from an ASS file built with the composition's own
   *  layout, so no story pays for Chromium frame painting. */
  static supportsStory(job: RenderJob): boolean {
    return job.compositionId === STORY_COMPOSITION_ID;
  }

  async render(job: RenderJob, outputLocation: string): Promise<void> {
    const { compositionId, inputProps } = EditDocs.parse(job.compositionId, job.inputProps);
    const tags = RenderTags.args(job.metadata);
    if (compositionId === STORY_COMPOSITION_ID) {
      return this.renderStory(inputProps as StoryVideoProps, outputLocation, tags);
    }
    const p = inputProps as ClipProps;
    const crop = ClipGeometry.resolveCrop(p);
    const { width: cw, height: ch } = ClipGeometry.cropDims(crop, p.srcWidth, p.srcHeight);
    const cx = evenFloor(crop.x * p.srcWidth);
    const cy = evenFloor(crop.y * p.srcHeight);
    const { width: fw, height: fh } = ClipGeometry.formatDims(p.format);
    const duration = Math.max(0.001, p.outSec - p.inSec);
    const vf = `crop=${cw}:${ch}:${cx}:${cy},scale=${fw}:${fh}`;
    await run(FFMPEG, [
      "-y",
      "-ss",
      String(p.inSec),
      "-i",
      p.src,
      "-t",
      String(duration),
      "-filter:v",
      vf,
      "-r",
      String(p.fps),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart+use_metadata_tags",
      ...tags,
      outputLocation,
    ]);
  }

  /**
   * Captionless story render without Chromium: each scene becomes a self-contained
   * segment (Ken Burns still or looped/held clip, vignette + film grain, its own audio
   * padded to the scene+gap length), the segments concat, then a looped music bed mixes
   * over the whole. Minutes of Remotion frame-painting collapse to a few ffmpeg passes.
   */
  private async renderStory(
    props: StoryVideoProps,
    outputLocation: string,
    tags: string[],
  ): Promise<void> {
    const fps = props.fps;
    const width = evenFloor(props.width);
    const height = evenFloor(props.height);
    const gap = typeof props.sceneGap === "number" ? props.sceneGap : DEFAULT_SCENE_GAP;
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "story-"));
    try {
      const segments: string[] = [];
      for (let i = 0; i < props.scenes.length; i++) {
        segments.push(await this.segment(props, props.scenes[i], i, work));
      }
      if (props.endCard) {
        const seg = path.join(work, "end_card.mp4");
        await this.renderEndCard(props.endCard, width, height, fps, seg);
        segments.push(seg);
      }

      const joined = path.join(work, "joined.mp4");
      const listFile = path.join(work, "concat.txt");
      fs.writeFileSync(listFile, segments.map((s) => `file '${s}'`).join("\n"));
      await run(FFMPEG, ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", joined]);

      const length = MusicBed.length(props.scenes, gap) + (props.endCard?.seconds ?? 0);
      const bed = props.music ? await MusicLoop.bed(props.music, length, work) : null;
      await run(FFMPEG, [
        "-y",
        "-i",
        joined,
        ...(bed ? ["-stream_loop", "-1", "-i", bed] : []),
        "-filter_complex",
        bed ? await this.musicMix(props, bed, gap, length, joined) : `[0:a]${MASTER}[a]`,
        "-map",
        "0:v",
        "-map",
        "[a]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-shortest",
        "-movflags",
        "+faststart+use_metadata_tags",
        ...tags,
        outputLocation,
      ]);
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  }

  /** Renders the story's scenes into the segment cache only, ahead of their assembly. */
  async prewarm(props: StoryVideoProps): Promise<void> {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "prewarm-"));
    try {
      for (let i = 0; i < props.scenes.length; i++) {
        if (props.scenes[i].key) await this.segment(props, props.scenes[i], i, work);
      }
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  }

  /** The scene's segment: kept from an earlier render of the same content, else made now. */
  private segment(
    props: StoryVideoProps,
    scene: StoryScene,
    position: number,
    work: string,
  ): Promise<string> {
    const width = evenFloor(props.width);
    const height = evenFloor(props.height);
    const gap = typeof props.sceneGap === "number" ? props.sceneGap : DEFAULT_SCENE_GAP;
    const index = scene.index ?? position;
    const make = async (out: string) => {
      const captions = this.captionFile(props, scene, width, height, gap, work, index);
      await this.renderScene(scene, index, width, height, props.fps, gap, out, captions);
    };
    if (!this.segments || !scene.key || props.reuseScenes === false) {
      const out = path.join(work, `seg_${index}.mp4`);
      return make(out).then(() => out);
    }
    const hash = createHash("sha256")
      .update(
        JSON.stringify([
          this.stamp,
          scene.key,
          index,
          width,
          height,
          props.fps,
          gap,
          props.showCaptions,
          props.karaoke ?? false,
          props.captionColor ?? "",
          props.captionScale ?? 1,
          props.captionPosition ?? "",
        ]),
      )
      .digest("hex");
    return this.segments.get(hash, make);
  }

  /** Voice and music brought to one loudness, the bed ducked under every scene that speaks
   *  and faded out at the end, then the whole mix levelled. */
  private async musicMix(
    props: StoryVideoProps,
    music: string,
    gap: number,
    length: number,
    joined: string,
  ): Promise<string> {
    const [voiceGain, musicGain] = await Promise.all([Loudness.gain(joined), Loudness.gain(music)]);
    const level = props.musicVolume ?? MusicBed.LEVEL;
    const under = props.musicUnderVoice ?? MusicBed.UNDER_VOICE;
    const curve = MusicBed.expression(MusicBed.spoken(props.scenes, gap), length, level, under);
    return (
      `[0:a]volume=${voiceGain.toFixed(2)}dB[v];` +
      `[1:a]volume=${musicGain.toFixed(2)}dB,volume='${curve}':eval=frame[m];` +
      `[v][m]amix=inputs=2:duration=first:normalize=0:dropout_transition=0,${MASTER}[a]`
    );
  }

  /** The scene's burned captions as an ASS file in the work dir, or null when it has none. */
  private captionFile(
    props: StoryVideoProps,
    scene: StoryScene,
    width: number,
    height: number,
    gap: number,
    work: string,
    index: number,
  ): string | null {
    if (!props.showCaptions || !scene.words?.length) return null;
    const ass = AssCaptions.build(scene.words, sceneDurationSec(scene, gap), {
      width,
      height,
      color: props.captionColor,
      scale: props.captionScale,
      position: props.captionPosition,
      karaoke: props.karaoke,
    });
    if (!ass) return null;
    const file = path.join(work, `captions_${index}.ass`);
    fs.writeFileSync(file, ass);
    return file;
  }

  /** One scene as a standalone segment: video (Ken Burns still or clip) + graded overlays
   *  + burned captions + an audio track padded to the exact scene length so the concat
   *  lines up. */
  private async renderScene(
    scene: StoryScene,
    index: number,
    width: number,
    height: number,
    fps: number,
    gap: number,
    segPath: string,
    captions: string | null,
  ): Promise<void> {
    const dur = sceneDurationSec(scene, gap);
    const frames = Math.max(1, Math.round(dur * fps));
    // Captions go on after the grain and vignette so the text stays crisp, as in the preview.
    const subtitles = captions ? `,subtitles=filename='${captions}'` : "";
    // A still has its vignette drawn once, into the picture, before it moves; a clip on
    // every frame.
    const grain = scene.flat ? "" : `,${GRAIN}`;
    const grade = `${scene.flat ? "" : `${VIGNETTE},`}format=yuv420p${grain}${subtitles}`;
    const still = `format=yuv420p${grain}${subtitles}`;

    const inputs: string[] = [];
    let videoChain: string;
    let audioLabel: string; // the [n:a] the audio chain reads from
    let last = "";

    if (scene.video) {
      inputs.push("-i", scene.video);
      const fit = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`;
      const clip = await FfmpegDriver.seconds(scene.video);
      const holdFrames = frames - Math.round(clip * fps);
      if (clip > 0 && holdFrames > 1) {
        // A clip shorter than its scene plays once, then its last frame holds and slowly
        // closes in for the rest, so nothing restarts or freezes.
        last = `${segPath}.last.png`;
        await FfmpegDriver.lastFrame(scene.video, last);
        inputs.push("-i", last);
        const vignette = scene.flat ? "" : `${VIGNETTE},`;
        videoChain =
          `[0:v]${fit},fps=${fps},trim=duration=${clip.toFixed(3)},setpts=PTS-STARTPTS,${vignette}format=yuv420p[c];` +
          `[1:v]${FfmpegDriver.hold(holdFrames, width, height, fps)},${vignette}format=yuv420p[h];` +
          `[c][h]concat=n=2:v=1:a=0,${still}[v]`;
      } else {
        videoChain = `[0:v]${fit},${grade}[v]`;
      }
      // A clip meant to speak for itself but made silent (a fallback model) plays muted, under
      // the voiceover when there is one.
      audioLabel = scene.video_audio && (await hasAudio(scene.video)) ? "0:a" : "";
    } else {
      // Stills: Ken Burns (alternating zoom-in / zoom-out + a gentle drift), matching the
      // composition, one picture after another with a crossfade. Upscale first so the zoom
      // samples real pixels instead of blurring.
      const pictures = scene.images && scene.images.length > 1 ? scene.images : [scene.image];
      if (!pictures[0]) throw new Error(`scene ${index + 1} has no image or clip to render`);
      const n = pictures.length;
      const fade = n > 1 ? Math.min(STILL_FADE_FRAMES, Math.floor(frames / n / 3)) : 0;
      const each = Math.ceil((frames + (n - 1) * fade) / n);
      const parts = pictures.map((picture, k) => {
        inputs.push(...(n > 1 ? [] : ["-loop", "1"]), "-i", picture);
        const move = FfmpegDriver.kenBurns(
          (index + k) % 2 === 0,
          each,
          width,
          height,
          fps,
          !scene.flat,
        );
        return `[${k}:v]${move}[p${k}]`;
      });
      let last = "p0";
      for (let k = 1; k < n; k++) {
        const offset = ((k * (each - fade)) / fps).toFixed(4);
        const out = `x${k}`;
        parts.push(
          `[${last}][p${k}]xfade=transition=fade:duration=${(fade / fps).toFixed(4)}:offset=${offset}[${out}]`,
        );
        last = out;
      }
      videoChain = `${parts.join(";")};[${last}]${still}[v]`;
      audioLabel = "";
    }

    // Resolve the audio track. Native-audio clips already have audioLabel; others take the
    // scene voiceover, or silence for an image/looped-clip scene with none.
    let audioChain: string;
    if (audioLabel) {
      audioChain = `[${audioLabel}]apad,atrim=0:${dur},asetpts=N/SR/TB[a]`;
    } else if (scene.audio) {
      const ai = inputs.filter((arg) => arg === "-i").length;
      inputs.push("-i", scene.audio);
      audioChain = `[${ai}:a]apad,atrim=0:${dur},asetpts=N/SR/TB[a]`;
    } else {
      const ai = inputs.filter((arg) => arg === "-i").length;
      inputs.push(
        "-f",
        "lavfi",
        "-t",
        String(dur),
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=48000",
      );
      audioChain = `[${ai}:a]atrim=0:${dur},asetpts=N/SR/TB[a]`;
    }

    try {
      await run(FFMPEG, [
        "-y",
        ...inputs,
        "-filter_complex",
        `${videoChain};${audioChain}`,
        "-map",
        "[v]",
        "-map",
        "[a]",
        ...FfmpegDriver.segmentOutput(fps, dur),
        segPath,
      ]);
    } finally {
      if (last) fs.rmSync(last, { force: true });
    }
  }

  /** The closing card: the picture held still, up from black and back to it, silent. */
  private async renderEndCard(
    card: EndCard,
    width: number,
    height: number,
    fps: number,
    segPath: string,
  ): Promise<void> {
    const dur = card.seconds;
    const out = Math.max(0, dur - CARD_FADE_OUT).toFixed(3);
    await run(FFMPEG, [
      "-y",
      "-loop",
      "1",
      "-i",
      card.image,
      "-f",
      "lavfi",
      "-t",
      String(dur),
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=48000",
      "-filter_complex",
      `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},` +
        `format=yuv420p,fade=t=in:d=${CARD_FADE_IN},fade=t=out:st=${out}:d=${CARD_FADE_OUT}[v]`,
      "-map",
      "[v]",
      "-map",
      "1:a",
      ...FfmpegDriver.segmentOutput(fps, dur),
      segPath,
    ]);
  }

  /** How every story segment is encoded, so they join without a re-encode. */
  private static segmentOutput(fps: number, seconds: number): string[] {
    return [
      "-r",
      String(fps),
      "-t",
      String(seconds),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-ac",
      "2",
    ];
  }

  /** One still's Ken Burns move over `frames`, zooming in or out. */
  /** A held frame that closes in slowly from exactly as it was, centred. */
  private static hold(frames: number, width: number, height: number, fps: number): string {
    const d = Math.max(1, frames - 1);
    return (
      `scale=${width * KB_UPSCALE}:${height * KB_UPSCALE}:force_original_aspect_ratio=increase,` +
      `crop=${width * KB_UPSCALE}:${height * KB_UPSCALE},` +
      `zoompan=z='1+${HOLD_ZOOM}*on/${d}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${frames}:s=${width}x${height}:fps=${fps},setpts=PTS-STARTPTS`
    );
  }

  /** How long the clip runs; 0 when ffprobe cannot tell. */
  private static async seconds(file: string): Promise<number> {
    const raw = await probe(file, ["-show_entries", "format=duration"]).catch(() => "");
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  }

  /** The clip's last frame as a picture. */
  private static async lastFrame(file: string, out: string): Promise<void> {
    await run(FFMPEG, ["-y", "-sseof", "-1", "-i", file, "-update", "1", "-an", out]);
  }

  private static kenBurns(
    zoomIn: boolean,
    frames: number,
    width: number,
    height: number,
    fps: number,
    vignette: boolean,
  ): string {
    const z0 = zoomIn ? 1.05 : 1.14;
    const z1 = zoomIn ? 1.14 : 1.05;
    const pxs = zoomIn ? -1.8 : 1.8;
    const pxe = zoomIn ? 1.8 : -1.8;
    const pys = 1.2;
    const pye = -1.2;
    const d = Math.max(1, frames - 1);
    // As the composition's scale() translate(): the view drifts against the pan.
    const z = `${z0}+(${(z1 - z0).toFixed(5)})*on/${d}`;
    const x = `(iw-iw/zoom)/2-((${pxs})+(${(pxe - pxs).toFixed(5)})*on/${d})/100*iw`;
    const y = `(ih-ih/zoom)/2-((${pys})+(${(pye - pys).toFixed(5)})*on/${d})/100*ih`;
    return (
      `scale=${width * KB_UPSCALE}:${height * KB_UPSCALE}:force_original_aspect_ratio=increase,` +
      `crop=${width * KB_UPSCALE}:${height * KB_UPSCALE},${vignette ? `${VIGNETTE},` : ""}` +
      `zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=${width}x${height}:fps=${fps},setpts=PTS-STARTPTS`
    );
  }
}
