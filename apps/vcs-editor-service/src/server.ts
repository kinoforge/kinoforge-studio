import { randomUUID, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAPTIONED_COMPOSITION_ID,
  CaptionPlacement,
  type Caption,
  type CaptionWord,
  EditDocs,
  ExplainerKit,
  STORY_COMPOSITION_ID,
  type StoryVideoProps,
} from "@vcs/remotion";
import express, { type Request, type Response } from "express";
import { CachingDriver } from "./caching-driver.ts";
import { type RenderJob, RenderTags } from "./driver.ts";
import { FfmpegDriver } from "./ffmpeg-driver.ts";
import { RemotionDriver } from "./remotion-driver.ts";
import { SmartDriver } from "./smart-driver.ts";
import { SegmentCache } from "./segment-cache.ts";
import { RendererStamp } from "./stamp.ts";

const PORT = Number(process.env.PORT || 3000);
const OUTPUT_DIR = process.env.OUTPUT_DIR || "/app/output";
const CACHE_DIR = process.env.RENDER_CACHE_DIR || path.join(OUTPUT_DIR, ".render-cache");
const SEGMENT_DIR = process.env.SEGMENT_CACHE_DIR || path.join(OUTPUT_DIR, ".segment-cache");
const SEGMENT_CACHE_MB = Number(process.env.SEGMENT_CACHE_MB || 6000);
const RENDER_CACHE_MB = Number(process.env.RENDER_CACHE_MB || 2000);
const STAMP = RendererStamp.of();
const ffmpeg = new FfmpegDriver(
  new SegmentCache(SEGMENT_DIR, SEGMENT_CACHE_MB * 1024 * 1024),
  STAMP,
);

// Two engines behind the seam: ffmpeg (fast, plain cuts) and Remotion (rich,
// composited). SmartDriver routes by capability; CachingDriver skips re-encodes.
// Add a license-free rich driver by swapping RemotionDriver here.
const driver = new CachingDriver(
  new SmartDriver(
    ffmpeg,
    new RemotionDriver(),
    (doc) => FfmpegDriver.supports(doc) || FfmpegDriver.supportsStory(doc),
  ),
  CACHE_DIR,
  STAMP,
  RENDER_CACHE_MB * 1024 * 1024,
);

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(requireToken(process.env.EDITOR_SERVICE_TOKEN || ""));

// With a token set, every caller must send it as a bearer, except the health probe and
// headless Chromium reading /media from inside this container.
function requireToken(token: string) {
  const expected = Buffer.from(token);
  return (req: Request, res: Response, next: () => void) => {
    if (!token || req.path === "/health" || isLoopback(req.socket.remoteAddress)) return next();
    const header = req.get("authorization") || "";
    const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7).trim() : "");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return next();
    res.status(401).json({ error: "unauthorized" });
  };
}

function isLoopback(address: string | undefined): boolean {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

// Serve the source video (and any output media) locally so headless Chromium
// reads frames straight off the mounted volume, no cross-container streaming.
app.use("/media", express.static(OUTPUT_DIR));

// Serve the built editor SPA when present, so the one service ships both the
// render API and the UI. In dev the UI runs from Vite (web:dev) and proxies here.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.join(__dirname, "..", "web", "dist");
if (fs.existsSync(WEB_DIST)) app.use(express.static(WEB_DIST));

function safeSegment(s: string): boolean {
  return !!s && !s.includes("..") && !s.includes("/") && !s.includes("\\");
}

/** A relative dir under OUTPUT_DIR that cannot escape it (no "..", not absolute). */
function safeRelDir(s: string | undefined): boolean {
  if (!s || s.includes("..") || s.includes("\\") || path.isAbsolute(s)) return false;
  const resolved = path.resolve(OUTPUT_DIR, s);
  return resolved === OUTPUT_DIR || resolved.startsWith(OUTPUT_DIR + path.sep);
}

function mediaUrl(sourceRel: string): string {
  // Already absolute (a signed assets-gateway URL from the backend), use it as-is; only a
  // bare OUTPUT-relative path is served off this service's local /media mount.
  if (/^https?:\/\//i.test(sourceRel)) return sourceRel;
  const encoded = sourceRel.split("/").map(encodeURIComponent).join("/");
  return `http://127.0.0.1:${PORT}/media/${encoded}`;
}

// Where a render writes and how it is delivered. When the backend supplies a signed
// `uploadUrl`, the service owns its own output: render to a private temp file, PUT it to the
// assets gateway, then delete the temp, it never touches a shared volume. With no uploadUrl
// (local dev), it writes into OUTPUT_DIR/<relDir>/<name> as before, off the mounted volume.
async function renderTo(
  job: RenderJob,
  localDir: string,
  name: string,
  uploadUrl: string | undefined,
): Promise<void> {
  if (!uploadUrl) {
    fs.mkdirSync(localDir, { recursive: true });
    await driver.render(job, path.join(localDir, name));
    return;
  }
  const tmp = path.join(os.tmpdir(), `render-${randomUUID()}.mp4`);
  try {
    await driver.render(job, tmp);
    await putFile(uploadUrl, tmp);
  } finally {
    await fs.promises.unlink(tmp).catch(() => {});
  }
}

/** Streams a file to a signed PUT url, so a long film never sits in memory whole. */
async function putFile(url: string, file: string): Promise<void> {
  const { size } = await fs.promises.stat(file);
  const target = new URL(url);
  const send = target.protocol === "https:" ? https.request : http.request;
  await new Promise<void>((resolve, reject) => {
    const req = send(
      target,
      { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Length": size } },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          if (text.length < 200) text += chunk;
        });
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          if (status >= 200 && status < 300) resolve();
          else reject(new Error(`assets upload ${status}: ${text.slice(0, 200)}`));
        });
      },
    );
    req.on("error", reject);
    fs.createReadStream(file).on("error", reject).pipe(req);
  });
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "vcs-editor-service" });
});

// The explainer kit a board writer works from: its JSON schema, catalog and named assets.
const EXPLAINER_KIT = ExplainerKit.describe();
app.get("/v1/kits/explainer", (_req: Request, res: Response) => {
  res.json(EXPLAINER_KIT);
});

interface CaptionBody {
  slug: string;
  clip_id: string;
  clipRel: string; // base clip path relative to OUTPUT_DIR (already cut/cropped)
  width: number;
  height: number;
  fps: number;
  inSec: number; // base clip's absolute start in source (caption time offset)
  durationSec: number;
  captions?: Caption[];
  uploadUrl?: string; // signed gateway PUT url; when set the service uploads its output itself
}

// ---------------------------------------------------------------------------
// Captioned variant: burn the caption track onto an already-cut base clip.
// Written to clips/<clip_id>/variants/captioned.mp4. Same stateless contract as
// /render, the Python worker tracks queueing/progress.
// ---------------------------------------------------------------------------
app.post("/caption", async (req: Request, res: Response) => {
  const b = req.body as CaptionBody;
  if (!safeSegment(b?.slug) || !safeSegment(b?.clip_id)) {
    return res.status(400).json({ ok: false, error: "Invalid slug or clip_id" });
  }
  if (!b.clipRel) {
    return res.status(400).json({ ok: false, error: "Missing clipRel" });
  }

  const inputProps = {
    src: mediaUrl(b.clipRel),
    fps: b.fps,
    width: b.width,
    height: b.height,
    inSec: b.inSec,
    durationSec: b.durationSec,
    captions: b.captions || [],
  };

  try {
    const outDir = path.join(OUTPUT_DIR, "videos", b.slug, "clips", b.clip_id, "variants");
    await renderTo(
      { compositionId: CAPTIONED_COMPOSITION_ID, inputProps },
      outDir,
      "captioned.mp4",
      b.uploadUrl,
    );
    res.json({ ok: true, file: `${b.clip_id}/variants/captioned.mp4` });
  } catch (e) {
    console.error("Caption render failed:", e);
    res.status(500).json({ ok: false, error: String(e instanceof Error ? e.message : e) });
  }
});

interface StoryScene {
  image: string; // path relative to OUTPUT_DIR
  images?: string[]; // a stills scene's pictures in turn (the first is image)
  video?: string; // generated clip (Video Mode); plays instead of the Ken Burns still
  video_seconds?: number; // the clip's own length; it loops to fill a longer scene
  video_audio?: boolean; // preserve clip-native audio instead of muting it for voiceover
  flat?: boolean; // drawn graphics (an explainer board): no vignette or grain
  audio?: string; // path relative to OUTPUT_DIR
  seconds: number;
  words?: CaptionWord[];
}

interface StoryBody {
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
  music?: string; // path relative to OUTPUT_DIR
  musicVolume?: number; // the bed between lines, 0..1
  musicUnderVoice?: number; // the bed while a scene speaks, 0..1
  out?: string; // output basename (e.g. "video-2.mp4"); backend versions renders
  out_dir?: string; // dir relative to OUTPUT_DIR (e.g. videogen/series/<sid>/episodes/3)
  uploadUrl?: string; // signed gateway PUT url; when set the service uploads its output itself
  metadata?: Record<string, string>; // tags written into the file (e.g. comment)
  endCard?: { image: string; seconds: number }; // a picture the film closes on
  callbackUrl?: string; // answer at once and post the outcome here when the render ends
  renderId?: string; // the caller's name for the render, to ask whether it still runs
  scenes: (StoryScene & { index?: number; key?: string })[];
}

/** A story request's problem, or "" when it can be rendered. */
function storyProblem(b: StoryBody): string {
  if (!safeSegment(b?.pid)) return "Invalid pid";
  if (!Array.isArray(b.scenes) || b.scenes.length === 0) return "Missing scenes";
  return "";
}

/** Posts a render's outcome to the caller, trying again a few times. */
async function callBack(url: string, outcome: Record<string, unknown>): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outcome),
      });
      if (res.ok || (res.status >= 400 && res.status < 500)) return;
    } catch (e) {
      console.error("render callback failed:", e);
    }
    await new Promise((r) => setTimeout(r, 5000 * 2 ** attempt));
  }
}

// Scenes rendered ahead run one story at a time, so they never crowd out a render.
let prewarming: Promise<void> = Promise.resolve();

/** Story renders handed over with a callback. Each stays on disk until its outcome is
 * posted, so a restart (a deploy, a crash) picks it up again; one cut short too often fails. */
class StoryRenders {
  static readonly DIR = path.join(OUTPUT_DIR, ".renders");
  static readonly MAX_STARTS = 3;
  static readonly running = new Set<string>();

  static start(id: string, b: StoryBody, starts = 1): void {
    const file = path.join(StoryRenders.DIR, `${id}.json`);
    fs.mkdirSync(StoryRenders.DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ body: b, starts }));
    StoryRenders.running.add(id);
    const url = b.callbackUrl!;
    renderStory(b)
      .then(
        (out) => callBack(url, { ok: true, file: out }),
        (e) => {
          console.error("Story render failed:", e);
          return callBack(url, { ok: false, error: String(e instanceof Error ? e.message : e) });
        },
      )
      .finally(() => {
        StoryRenders.running.delete(id);
        fs.rmSync(file, { force: true });
      });
  }

  static resume(): void {
    let names: string[] = [];
    try {
      names = fs.readdirSync(StoryRenders.DIR).filter((n) => n.endsWith(".json"));
    } catch {
      return;
    }
    for (const name of names) {
      const file = path.join(StoryRenders.DIR, name);
      try {
        const { body, starts } = JSON.parse(fs.readFileSync(file, "utf8"));
        if (starts >= StoryRenders.MAX_STARTS) {
          fs.rmSync(file, { force: true });
          void callBack(body.callbackUrl, {
            ok: false,
            error: `the render was cut short ${starts} times`,
          });
          continue;
        }
        console.log(`resuming story render ${name} (start ${starts + 1})`);
        StoryRenders.start(name.slice(0, -5), body, starts + 1);
      } catch (e) {
        console.error("Story render resume failed:", e);
        fs.rmSync(file, { force: true });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// AI video-gen assembly: still images (Ken Burns) + per-scene voiceover +
// captions -> one mp4 at videogen/<pid>/video.mp4. Stateless like /render; the
// Python worker tracks progress.
// ---------------------------------------------------------------------------
function storyProps(b: StoryBody) {
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
    music: b.music ? mediaUrl(b.music) : undefined,
    musicVolume: typeof b.musicVolume === "number" ? b.musicVolume : undefined,
    musicUnderVoice: typeof b.musicUnderVoice === "number" ? b.musicUnderVoice : undefined,
    endCard:
      b.endCard?.image && b.endCard.seconds > 0
        ? { image: mediaUrl(b.endCard.image), seconds: Math.min(b.endCard.seconds, 10) }
        : undefined,
    scenes: b.scenes.map((s) => ({
      image: s.image ? mediaUrl(s.image) : "",
      images: Array.isArray(s.images) ? s.images.map((i) => mediaUrl(i)) : undefined,
      video: s.video ? mediaUrl(s.video) : undefined,
      video_seconds: s.video_seconds,
      video_audio: s.video_audio === true,
      flat: s.flat === true || undefined,
      audio: s.audio ? mediaUrl(s.audio) : undefined,
      seconds: s.seconds,
      words: s.words || [],
      index: Number.isInteger(s.index) && s.index! >= 0 ? s.index : undefined,
      key: typeof s.key === "string" && s.key ? s.key : undefined,
    })),
  };
}

app.get("/renders/:id", (req: Request, res: Response) => {
  const running = StoryRenders.running.has(String(req.params.id));
  res.status(running ? 200 : 404).json({ running });
});

/** Renders a story film; answers where it went. */
function renderStory(b: StoryBody): Promise<string> {
  const outName = b.out && safeSegment(b.out) && b.out.endsWith(".mp4") ? b.out : "video.mp4";
  // The backend picks the folder (flat videogen/<pid>, or a nested series
  // episode); accept it only when it stays inside OUTPUT_DIR.
  const relDir = safeRelDir(b.out_dir) ? b.out_dir! : `videogen/${b.pid}`;
  return renderTo(
    {
      compositionId: STORY_COMPOSITION_ID,
      inputProps: storyProps(b),
      metadata: RenderTags.of(b.metadata),
    },
    path.join(OUTPUT_DIR, relDir),
    outName,
    b.uploadUrl,
  ).then(() => `${relDir}/${outName}`);
}

app.post("/prewarm-story", (req: Request, res: Response) => {
  const b = req.body as StoryBody;
  const problem = storyProblem(b);
  if (problem) return res.status(400).json({ ok: false, error: problem });
  res.status(202).json({ ok: true });
  const props = storyProps(b) as StoryVideoProps;
  prewarming = prewarming
    .then(() => ffmpeg.prewarm(props))
    .catch((e) => console.error("Story prewarm failed:", e));
});

app.post("/render-story", async (req: Request, res: Response) => {
  const b = req.body as StoryBody;
  const problem = storyProblem(b);
  if (problem) return res.status(400).json({ ok: false, error: problem });
  try {
    if (b.callbackUrl) {
      const id = typeof b.renderId === "string" && safeSegment(b.renderId) ? b.renderId : "";
      StoryRenders.start(id || randomUUID(), b);
      res.status(202).json({ ok: true, accepted: true });
      return;
    }
    res.json({ ok: true, file: await renderStory(b) });
  } catch (e) {
    console.error("Story render failed:", e);
    res.status(500).json({ ok: false, error: String(e instanceof Error ? e.message : e) });
  }
});

const SOURCE_EXT = /^\.(mp4|mov|webm|mkv|m4v|jpg|jpeg|png|mp3|wav|m4a)$/;

// ---------------------------------------------------------------------------
// Import a source file for the editor: raw bytes in, a servable /media URL out.
// Stored under uploads/ with a random id so names never collide or escape. Lets
// the standalone editor work on local media without a separate asset store.
// ---------------------------------------------------------------------------
app.put(
  "/v1/source",
  express.raw({ type: () => true, limit: "4096mb" }),
  (req: Request, res: Response) => {
    const name = typeof req.query.name === "string" ? req.query.name : "";
    const ext = path.extname(name).toLowerCase();
    if (!SOURCE_EXT.test(ext)) {
      return res.status(400).json({ ok: false, error: "unsupported file type" });
    }
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return res.status(400).json({ ok: false, error: "empty body" });
    }
    const rel = `uploads/${randomUUID()}${ext}`;
    fs.mkdirSync(path.join(OUTPUT_DIR, "uploads"), { recursive: true });
    fs.writeFileSync(path.join(OUTPUT_DIR, rel), body);
    res.json({ ok: true, url: `/media/${rel}` });
  },
);

interface RenderBody {
  compositionId: string;
  inputProps: Record<string, unknown>;
  out?: string; // output basename (default render.mp4)
  out_dir?: string; // dir relative to OUTPUT_DIR (default "renders")
  uploadUrl?: string; // signed gateway PUT url; when set the service uploads its own output
  metadata?: Record<string, string>; // tags written into the file (e.g. comment)
}

// ---------------------------------------------------------------------------
// Generic render command: an EditDoc in, an mp4 out. The single entry the editor
// and the backend call for any composition. inputProps are validated up front so
// a bad shape is a 400 (caller error), not a mid-render 500. SmartDriver picks
// ffmpeg or Remotion; CachingDriver skips a re-encode of an identical doc.
// ---------------------------------------------------------------------------
app.post("/v1/render", async (req: Request, res: Response) => {
  const b = req.body as RenderBody;
  if (!b?.compositionId || typeof b.inputProps !== "object" || b.inputProps === null) {
    return res.status(400).json({ ok: false, error: "compositionId and inputProps are required" });
  }
  try {
    EditDocs.parse(b.compositionId, b.inputProps);
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e instanceof Error ? e.message : e) });
  }
  try {
    const outName = b.out && safeSegment(b.out) && b.out.endsWith(".mp4") ? b.out : "render.mp4";
    const relDir = safeRelDir(b.out_dir) ? b.out_dir! : "renders";
    await renderTo(
      {
        compositionId: b.compositionId,
        inputProps: b.inputProps,
        metadata: RenderTags.of(b.metadata),
      },
      path.join(OUTPUT_DIR, relDir),
      outName,
      b.uploadUrl,
    );
    res.json({ ok: true, file: `${relDir}/${outName}` });
  } catch (e) {
    console.error("Render failed:", e);
    res.status(500).json({ ok: false, error: String(e instanceof Error ? e.message : e) });
  }
});

StoryRenders.resume();
app.listen(PORT, () => {
  console.log(`vcs-editor-service listening on :${PORT} (output=${OUTPUT_DIR})`);
});
