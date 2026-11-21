import { randomUUID, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BoardFit, ExplainerKit, SkitKit, Skit3DKit, fitRequestSchema } from "@vcs/remotion";
import express, { type Request, type Response } from "express";
import { renderToStaticMarkup } from "react-dom/server";
import { CachingDriver } from "./caching-driver.ts";
import { FfmpegDriver } from "./ffmpeg-driver.ts";
import { LocalQueue } from "./queue/local-queue.ts";
import { Failure, type FlowRun, type Handlers, type RenderQueue } from "./queue/queue.ts";
import { RunnelQueue } from "./queue/runnel-queue.ts";
import { type Route, WorkDir } from "./queue/work.ts";
import { RemotionDriver } from "./remotion-driver.ts";
import { Media, RenderSpecs } from "./render-specs.ts";
import { SmartDriver } from "./smart-driver.ts";
import { SegmentCache } from "./segment-cache.ts";
import { RenderPlugin } from "./plugin.ts";
import { RendererStamp } from "./stamp.ts";
import { Inputs } from "./workers/inputs.ts";
import { Steps } from "./workers/steps.ts";
import { Upkeep } from "./workers/upkeep.ts";

const PORT = Number(process.env.PORT || 3000);
const OUTPUT_DIR = process.env.OUTPUT_DIR || "/app/output";
const CACHE_DIR = process.env.RENDER_CACHE_DIR || path.join(OUTPUT_DIR, ".render-cache");
const SEGMENT_DIR = process.env.SEGMENT_CACHE_DIR || path.join(OUTPUT_DIR, ".segment-cache");
const SEGMENT_CACHE_MB = Number(process.env.SEGMENT_CACHE_MB || 6000);
const RENDER_CACHE_MB = Number(process.env.RENDER_CACHE_MB || 2000);
const plugin = await RenderPlugin.load(process.env.REMOTION_PLUGIN);
const STAMP = RendererStamp.of(plugin ? [plugin.dir] : []);
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
    new RemotionDriver(undefined, plugin?.entry),
    (doc) => FfmpegDriver.supports(doc) || FfmpegDriver.supportsStory(doc),
  ),
  CACHE_DIR,
  STAMP,
  RENDER_CACHE_MB * 1024 * 1024,
  OUTPUT_DIR,
);


const app = express();
app.disable("x-powered-by");
// HTTPS only, no type guessing, no full URL in the referrer, framed only by itself.
app.use((_req, res, next) => {
  res.set({
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
  });
  next();
});
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


app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "vcs-editor-service" });
});

const KITS = {
  explainer: ExplainerKit.describe(),
  skit: SkitKit.describe(),
  skit3d: Skit3DKit.describe(),
};
app.get("/v1/kits/animated/:mode", (req: Request, res: Response) => {
  const kit = KITS[req.params.mode as keyof typeof KITS];
  if (!kit) return res.status(404).json({ ok: false, error: "no such kit" });
  res.json(kit);
});

app.post("/v1/kits/animated/explainer/fit", (req: Request, res: Response) => {
  const parsed = fitRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.message.slice(0, 500) });
  }
  try {
    res.json({ ok: true, problems: BoardFit.check(parsed.data, renderToStaticMarkup) });
  } catch (e) {
    console.error("Board fit failed:", e);
    res.status(500).json({ ok: false, error: String(e instanceof Error ? e.message : e) });
  }
});


const specs = new RenderSpecs(new Media(PORT, OUTPUT_DIR));
const inputs = new Inputs(specs, ffmpeg);
const steps = new Steps(specs, driver, ffmpeg);
const handlers: Handlers = {
  fetch: (ctx) => inputs.fetch(ctx),
  story: (ctx) => steps.render(ctx),
  board: (ctx) => steps.render(ctx),
  caption: (ctx) => steps.render(ctx),
  prewarm: (ctx) => steps.prewarm(ctx),
  upload: (ctx) => steps.upload(ctx),
  finish: (ctx) => steps.finish(ctx),
};
WorkDir.use(OUTPUT_DIR);
const queue: RenderQueue = RunnelQueue.fromEnv(handlers) ?? new LocalQueue(handlers);

async function submit(route: Route, body: Record<string, unknown>): Promise<FlowRun | null> {
  const spec = { route, body };
  const work = WorkDir.create(spec);
  try {
    const later = specs.later(spec);
    if (!later) return await queue.submit(work, specs.flow(spec));
    await queue.later(work, specs.flow(spec), later);
    return null;
  } catch (e) {
    work.remove();
    throw e;
  }
}

function accept(route: Route) {
  return async (req: Request, res: Response) => {
    const problem = specs.problem(route, req.body);
    if (problem) return res.status(400).json({ ok: false, error: problem });
    try {
      const run = await submit(route, req.body);
      const callback = typeof req.body.callbackUrl === "string" && req.body.callbackUrl;
      if (run && !callback) await settled(res, run);
      else res.status(202).json({ ok: true, accepted: true });
    } catch (e) {
      console.error(`${route} render failed:`, e);
      if (!res.headersSent) res.status(500).json({ ok: false, error: Failure.text(e) });
    }
  };
}

async function settled(res: Response, run: FlowRun): Promise<void> {
  if (res.destroyed) {
    void run.cancel();
    return;
  }
  const left = () => {
    if (!res.writableEnded) void run.cancel();
  };
  res.on("close", left);
  const outcome = await run.done;
  res.off("close", left);
  if (res.writableEnded || res.destroyed) return;
  if (outcome.ok) res.json({ ok: true, file: outcome.file });
  else res.status(500).json({ ok: false, error: outcome.error });
}

app.post("/caption", accept("caption"));
app.post("/v1/render", accept("board"));
app.post("/prewarm-story", accept("prewarm"));
app.post("/render-story", accept("story"));

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


const stop = new AbortController();
let httpServer: ReturnType<typeof app.listen> | undefined;
process.once("SIGTERM", () => {
  httpServer?.close();
  stop.abort();
  void queue.drained().finally(() => process.exit(0));
});
const upkeep = new Upkeep(queue, [
  { dir: SEGMENT_DIR, maxBytes: SEGMENT_CACHE_MB * 1024 * 1024 },
  { dir: CACHE_DIR, maxBytes: RENDER_CACHE_MB * 1024 * 1024 },
]);
await queue.start(stop.signal, {
  sweep: (signal) => upkeep.sweep(signal),
  doctor: (signal) => upkeep.doctor(signal),
});
httpServer = app.listen(PORT, () => {
  console.log(`vcs-editor-service listening on :${PORT} (output=${OUTPUT_DIR}, queue=${queue.name})`);
});
