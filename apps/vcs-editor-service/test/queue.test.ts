import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { Code } from "@kinoforge/runnel";
import { State } from "@kinoforge/runnel/rpc";
import { CachingDriver } from "../src/caching-driver.ts";
import { FfmpegDriver } from "../src/ffmpeg-driver.ts";
import { LocalQueue } from "../src/queue/local-queue.ts";
import type { Handlers, StepContext } from "../src/queue/queue.ts";
import { RunnelQueue } from "../src/queue/runnel-queue.ts";
import { Settle } from "../src/queue/settle.ts";
import { WorkDir } from "../src/queue/work.ts";
import { RemotionDriver } from "../src/remotion-driver.ts";
import { Media, RenderSpecs } from "../src/render-specs.ts";
import { CacheTrim, SegmentCache } from "../src/segment-cache.ts";
import { Inputs } from "../src/workers/inputs.ts";
import { Steps } from "../src/workers/steps.ts";
import { Upkeep } from "../src/workers/upkeep.ts";
import type { RenderDriver } from "../src/driver.ts";

const output = fs.mkdtempSync(path.join(os.tmpdir(), "editor-queue-"));
WorkDir.use(output);
const specs = new RenderSpecs(new Media(3999, output));

const story = (extra: Record<string, unknown> = {}) => ({
  pid: "p1",
  width: 1080,
  height: 1920,
  fps: 30,
  scenes: [
    { image: "", seconds: 2, key: "a" },
    { image: "", seconds: 3, key: "b" },
  ],
  ...extra,
});

function handlers(over: Partial<Handlers> = {}): Handlers {
  const idle = async () => undefined;
  return {
    fetch: idle,
    story: idle,
    board: idle,
    caption: idle,
    prewarm: idle,
    upload: async ({ work }: StepContext) => {
      work.write("made.json", { file: "videogen/p1/video.mp4" });
      return { file: "videogen/p1/video.mp4" };
    },
    finish: async ({ work, error }: StepContext) => {
      const made = work.has("made.json") ? (work.read("made.json") as { file: string }) : {};
      return error !== undefined ? { ok: false, error } : { ok: true, ...made };
    },
    ...over,
  };
}

after(() => fs.rmSync(output, { recursive: true, force: true }));

describe("flows", () => {
  const names = (spec: Parameters<RenderSpecs["flow"]>[0]) => specs.flow(spec).steps.map((s) => s.name);

  test("each route runs fetch, its render, upload and finish; prewarm skips upload", () => {
    assert.deepEqual(names({ route: "story", body: story() }), ["fetch", "story", "upload", "finish"]);
    assert.deepEqual(names({ route: "caption", body: {} as never }).at(1), "caption");
    const prewarm = specs.flow({ route: "prewarm", body: story() });
    assert.deepEqual(prewarm.steps.map((s) => s.name), ["fetch", "prewarm", "finish"]);
    assert.ok((prewarm.priority ?? 0) < 0);
  });

  test("a story's drawn scenes render beside each other after fetch, and the story waits for all", () => {
    const render = { compositionId: "ExplainerScene", inputProps: { seconds: 2 } };
    const scenes = [
      { image: "", seconds: 2, key: "a", render },
      { image: "", seconds: 2, key: "b" },
      { image: "", seconds: 2, key: "c", render },
    ];
    const steps = specs.flow({ route: "story", body: story({ scenes }) }).steps;
    const by = Object.fromEntries(steps.map((s) => [s.name, s]));
    assert.deepEqual(by["board-0"], { name: "board-0", kind: "board", after: ["fetch"], part: 0 });
    assert.deepEqual(by["board-2"].after, ["fetch"]);
    assert.deepEqual(by.story.after, ["board-0", "board-2"]);
    assert.deepEqual(by.upload.after, ["story"]);
  });

  test("only a prewarm waits for its burst, keyed by its film", () => {
    assert.equal(specs.later({ route: "story", body: story() }), undefined);
    assert.equal(specs.later({ route: "prewarm", body: story() })?.key, "prewarm:p1");
  });

  test("a render without a place of its own lands under renders, named by its work", () => {
    const work = WorkDir.create({ route: "board", body: {} });
    assert.equal(specs.target({ route: "story", body: story() }, work).file, `renders/${work.id}.mp4`);
    const named = { route: "caption" as const, body: { out: "captioned.mp4", out_dir: "videos/v/clips/c/variants" } };
    assert.equal(specs.target(named, work).file, "videos/v/clips/c/variants/captioned.mp4");
    work.remove();
  });

  test("a story's meta names the film, its scenes and length, and nothing signed", () => {
    const meta = specs.flow({ route: "story", body: story({ uploadUrl: "https://a/o/x?t=secret" }) }).meta;
    assert.deepEqual(meta, { route: "story", caller: "p1", scenes: "2", seconds: "5" });
  });

  test("runnel jobs carry only the work id, the spec stays on disk", async () => {
    const sent: unknown[] = [];
    const queue = new RunnelQueue({ url: "http://127.0.0.1:1", namespace: "editor", token: "" }, handlers());
    (queue.client as unknown as { enqueueFlow: (s: unknown) => unknown }).enqueueFlow = async (steps) => {
      sent.push(steps);
      return Object.fromEntries(Object.keys(steps as object).map((k) => [k, { id: `id-${k}`, duplicate: false }]));
    };
    const spec = { route: "story" as const, body: story({ uploadUrl: "https://a/o/x?t=secret" }) };
    const work = WorkDir.create(spec);
    await queue.submit(work, specs.flow(spec));
    const steps = sent[0] as Record<string, { job: { payload: unknown; queue: string }; after: string[] }>;
    for (const step of Object.values(steps)) assert.deepEqual(step.job.payload, { work: work.id });
    assert.deepEqual(Object.keys(steps), ["fetch", "story", "upload", "finish"]);
    assert.deepEqual(steps.upload.after, ["story"]);
    assert.equal(steps.story.job.queue, "story");
    assert.ok(!JSON.stringify(steps).includes("secret"));
    assert.equal((work.read("ids.json") as Record<string, string>).finish, "id-finish");
    work.remove();
  });

  test("runnel submit does not open waitJob streams unless done is awaited, and shutdown aborts active waits", async () => {
    const queue = new RunnelQueue({ url: "http://127.0.0.1:1", namespace: "editor", token: "" }, handlers());
    let waitCalls = 0;
    let observedSignal: AbortSignal | undefined;
    (queue.client as unknown as { enqueueFlow: (s: unknown) => unknown }).enqueueFlow = async (steps) =>
      Object.fromEntries(Object.keys(steps as object).map((k) => [k, { id: `id-${k}`, duplicate: false }]));
    (queue.client as unknown as { wait: (id: string, opts?: { signal?: AbortSignal }) => Promise<unknown> }).wait = (
      _id,
      opts,
    ) => {
      waitCalls++;
      observedSignal = opts?.signal;
      return new Promise((_resolve, reject) => {
        opts?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    };

    const asyncWork = WorkDir.create({ route: "story", body: story({ callbackUrl: "http://cb" }) });
    await queue.submit(asyncWork, specs.flow({ route: "story", body: story() }));
    assert.equal(waitCalls, 0);
    asyncWork.remove();

    const shutdown = new AbortController();
    (queue as unknown as { shutdown?: AbortSignal }).shutdown = shutdown.signal;
    const syncWork = WorkDir.create({ route: "story", body: story() });
    const run = await queue.submit(syncWork, specs.flow({ route: "story", body: story() }));
    assert.equal(waitCalls, 0);
    const p1 = run.done;
    const p2 = run.done;
    assert.strictEqual(p1, p2);
    assert.equal(waitCalls, 1);
    assert.equal(observedSignal?.aborted, false);
    shutdown.abort();
    const outcome = await p1;
    assert.equal(observedSignal?.aborted, true);
    assert.equal(outcome.ok, false);
    syncWork.remove();
  });
});

describe("local queue", () => {
  test("a lane runs no more at once than its concurrency", async () => {
    let now = 0;
    let most = 0;
    const queue = new LocalQueue(
      handlers({
        story: async () => {
          most = Math.max(most, ++now);
          await new Promise((r) => setTimeout(r, 20));
          now--;
        },
      }),
    );
    const runs = await Promise.all(
      [1, 2, 3].map(() => {
        const spec = { route: "story" as const, body: story() };
        return queue.submit(WorkDir.create(spec), specs.flow(spec));
      }),
    );
    const outcomes = await Promise.all(runs.map((r) => r.done));
    assert.equal(most, 1);
    assert.ok(outcomes.every((o) => o.ok && o.file === "videogen/p1/video.mp4"));
    assert.deepEqual(WorkDir.ids(), []);
  });

  test("a burst of prewarms renders once, with the last scenes sent", async () => {
    const seen: number[] = [];
    const queue = new LocalQueue(
      handlers({
        prewarm: async ({ work }: StepContext) => {
          seen.push((work.spec().body as { scenes: unknown[] }).scenes.length);
        },
      }),
    );
    const later = { key: "prewarm:p1", delayMs: 20 };
    for (const count of [1, 2, 3]) {
      const scenes = Array.from({ length: count }, (_, i) => ({ image: "", seconds: 1, key: `k${i}` }));
      const spec = { route: "prewarm" as const, body: story({ scenes }) };
      await queue.later(WorkDir.create(spec), specs.flow(spec), later);
    }
    assert.equal(WorkDir.ids().length, 1);
    await new Promise((r) => setTimeout(r, 80));
    assert.deepEqual(seen, [3]);
    assert.deepEqual(WorkDir.ids(), []);
  });

  test("a failed board stops its film: the story never runs and finish gets the scene's error", async () => {
    const ran: string[] = [];
    const queue = new LocalQueue(
      handlers({
        board: async ({ part }: StepContext) => {
          if (part === 1) throw new Error("scene 2: chromium crashed");
        },
        story: async () => {
          ran.push("story");
        },
      }),
    );
    const render = { compositionId: "ExplainerScene", inputProps: {} };
    const scenes = [
      { image: "", seconds: 1, key: "a", render },
      { image: "", seconds: 1, key: "b", render },
    ];
    const spec = { route: "story" as const, body: story({ scenes }) };
    const outcome = await (await queue.submit(WorkDir.create(spec), specs.flow(spec))).done;
    assert.deepEqual(outcome, { ok: false, error: "scene 2: chromium crashed" });
    assert.deepEqual(ran, []);
  });

  test("a failed step skips the rest, finish gets its error and the work dir goes", async () => {
    const ran: string[] = [];
    const queue = new LocalQueue(
      handlers({
        story: async () => {
          throw new Error("ffmpeg exited 1");
        },
        upload: async () => {
          ran.push("upload");
        },
      }),
    );
    const spec = { route: "story" as const, body: story() };
    const work = WorkDir.create(spec);
    const outcome = await (await queue.submit(work, specs.flow(spec))).done;
    assert.deepEqual(outcome, { ok: false, error: "ffmpeg exited 1" });
    assert.deepEqual(ran, []);
    assert.equal(work.exists, false);
  });
});

describe("inputs", () => {
  let server: http.Server;
  let base = "";
  const asked: string[] = [];

  before(async () => {
    server = http.createServer((req, res) => {
      asked.push(req.url ?? "");
      res.end(`bytes of ${req.url}`);
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => server.close());

  test("a story fetches only scenes not already rendered, and points them at local copies", async () => {
    asked.length = 0;
    const cachedFirst = { cached: (_p: unknown, _s: unknown, i: number) => i === 0 } as unknown as FfmpegDriver;
    const inputs = new Inputs(specs, cachedFirst);
    const spec = {
      route: "story" as const,
      body: story({
        scenes: [
          { image: `${base}/m/one.png?t=1`, seconds: 2, key: "a" },
          { image: `${base}/m/two.png?t=2`, audio: `${base}/m/two.mp3?t=3`, seconds: 2, key: "b" },
        ],
      }),
    };
    const work = WorkDir.create(spec);
    await inputs.fetch({ work, signal: new AbortController().signal });
    assert.deepEqual(asked.sort(), ["/m/two.mp3?t=3", "/m/two.png?t=2"]);
    const scenes = (work.spec().body as { scenes: { image: string; audio?: string }[] }).scenes;
    assert.equal(scenes[0].image, `${base}/m/one.png?t=1`);
    assert.match(scenes[1].image, /^http:\/\/127\.0\.0\.1:3999\/media\/work\/.+\/in\/[0-9a-f]{32}\.png$/);
    assert.equal(fs.readdirSync(work.inputs).length, 2);
    work.remove();
  });

  test("a drawn scene never fetches a still it does not show", async () => {
    asked.length = 0;
    const inputs = new Inputs(specs, { cached: () => false } as unknown as FfmpegDriver);
    const render = { compositionId: "Skit3DScene", inputProps: {} };
    const spec = {
      route: "story" as const,
      body: story({ scenes: [{ image: `${base}/m/gone.png?t=1`, audio: `${base}/m/a.mp3?t=2`, seconds: 2, key: "a", render }] }),
    };
    const work = WorkDir.create(spec);
    await inputs.fetch({ work, signal: new AbortController().signal });
    assert.deepEqual(asked, ["/m/a.mp3?t=2"]);
    work.remove();
  });

  test("board props fetch only urls on the upload host, never other text", async () => {
    asked.length = 0;
    const inputs = new Inputs(specs, { cached: () => false } as unknown as FfmpegDriver);
    const spec = {
      route: "board" as const,
      body: {
        compositionId: "Skit3DScene",
        uploadUrl: `${base}/o/out.mp4?t=9`,
        inputProps: { models: { man: { url: `${base}/m/man.glb?t=4` } }, link: "https://example.com/a.png" },
      },
    };
    const work = WorkDir.create(spec);
    await inputs.fetch({ work, signal: new AbortController().signal });
    assert.deepEqual(asked, ["/m/man.glb?t=4"]);
    const props = (work.spec().body as { inputProps: { link: string } }).inputProps;
    assert.equal(props.link, "https://example.com/a.png");
    work.remove();
  });
});

describe("steps", () => {
  test("a render tells its caller once that it started, however many steps it has", async () => {
    const notices: unknown[] = [];
    const server = http.createServer((req, res) => {
      let text = "";
      req.on("data", (c) => (text += c));
      req.on("end", () => {
        notices.push(JSON.parse(text));
        res.end("{}");
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const callbackUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/done`;
    const driver = { render: async (_job: unknown, out: string) => fs.writeFileSync(out, "mp4") } as unknown as RenderDriver;
    const steps = new Steps(specs, driver, { cached: () => false } as unknown as FfmpegDriver);
    const spec = { route: "board" as const, body: { compositionId: "ExplainerScene", inputProps: {}, callbackUrl } };
    const work = WorkDir.create(spec);
    const signal = new AbortController().signal;
    await steps.render({ work, signal });
    await steps.render({ work, signal });
    await new Promise((r) => setTimeout(r, 50));
    server.close();
    work.remove();
    assert.deepEqual(notices, [{ started: true }]);
  });

  test("Steps.put aborts promptly on signal and on socket idle timeout", async () => {
    const sockets = new Set<import("node:net").Socket>();
    const server = http.createServer((_req, _res) => {
    });
    server.on("connection", (s) => {
      sockets.add(s);
      s.on("close", () => sockets.delete(s));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/upload`;
    const file = path.join(output, "upload-test.mp4");
    fs.writeFileSync(file, Buffer.alloc(1024, 1));
    try {
      const ac = new AbortController();
      setTimeout(() => ac.abort(new Error("cancelled by worker")), 60);
      await assert.rejects(() => Steps.put(url, file, ac.signal, 5_000), /cancelled by worker|abort/i);

      await assert.rejects(() => Steps.put(url, file, undefined, 100), /timed out/i);
    } finally {
      for (const s of sockets) s.destroy();
      server.close();
      fs.rmSync(file, { force: true });
    }
  });

  test("FfmpegDriver stops ffmpeg when its AbortSignal fires", async () => {
    const driver = new FfmpegDriver();
    const out = path.join(output, "aborted-story.mp4");
    const png = path.join(output, "frame.png");
    fs.writeFileSync(
      png,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    );
    const jobProps = {
      width: 320,
      height: 240,
      fps: 30,
      showCaptions: false,
      scenes: [{ image: png, seconds: 60, words: [] }],
    };

    const pre = new AbortController();
    pre.abort(new Error("already stopped"));
    await assert.rejects(
      () => driver.render({ compositionId: "StoryVideo", inputProps: jobProps, signal: pre.signal }, out),
      /already stopped/,
    );

    const live = new AbortController();
    const started = Date.now();
    setTimeout(() => live.abort(new Error("lane timeout")), 150);
    await assert.rejects(
      () => driver.render({ compositionId: "StoryVideo", inputProps: jobProps, signal: live.signal }, out),
      /lane timeout/,
    );
    assert.ok(Date.now() - started < 5_000, "ffmpeg render did not exit promptly after abort");
    fs.rmSync(out, { force: true });
    fs.rmSync(png, { force: true });
  });
});

describe("upkeep", () => {
  test("the sweep removes work no flow holds and keeps live work", async () => {
    const live = WorkDir.create({ route: "story", body: story() });
    const gone = WorkDir.create({ route: "story", body: story() });
    const queue = new LocalQueue(handlers());
    (queue as unknown as { live: (w: WorkDir) => Promise<boolean> }).live = async (w) => w.id === live.id;
    const swept = await new Upkeep(queue, []).sweep(new AbortController().signal);
    assert.equal(swept.work, 1);
    assert.equal(live.exists, true);
    assert.equal(gone.exists, false);
    live.remove();
  });

  test("CacheTrim.keep ignores missing directories and files deleted mid-scan", async () => {
    await CacheTrim.keep(path.join(output, "does-not-exist"), 1024);
    const dir = fs.mkdtempSync(path.join(output, "trim-"));
    const a = path.join(dir, "aaaa.mp4");
    const b = path.join(dir, "bbbb.mp4");
    fs.writeFileSync(a, Buffer.alloc(64, 1));
    fs.writeFileSync(b, Buffer.alloc(64, 2));
    const realStat = fs.promises.stat;
    let tripped = false;
    fs.promises.stat = (async (p: fs.PathLike, opts?: fs.StatOptions) => {
      if (!tripped && String(p) === a) {
        tripped = true;
        fs.rmSync(a, { force: true });
      }
      return realStat(p, opts as never);
    }) as typeof fs.promises.stat;
    try {
      await CacheTrim.keep(dir, 10);
      assert.equal(fs.existsSync(a), false);
      assert.equal(fs.existsSync(b), false);
    } finally {
      fs.promises.stat = realStat;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("high and medium fixes", () => {
  test("RunnelQueue cancels siblings on failure and waits to remove work dir until in-flight sibling returns", async () => {
    let releaseBoard!: () => void;
    const boardEntered = new Promise<void>((r) => {
      releaseBoard = r;
    });
    let letBoardExit!: () => void;
    const boardWait = new Promise<void>((r) => {
      letBoardExit = r;
    });
    let dirExistedWhenBoardDone = false;

    const queue = new RunnelQueue(
      { url: "http://127.0.0.1:1", namespace: "editor", token: "" },
      handlers({
        board: async ({ work }) => {
          releaseBoard();
          await boardWait;
          dirExistedWhenBoardDone = work.exists;
        },
        finish: async ({ work, error, keepWork }) => {
          if (!keepWork) work.remove();
          return error !== undefined ? { ok: false, error } : { ok: true };
        },
      }),
    );

    const cancelled: string[] = [];
    const states = new Map<string, { state: string; final: boolean }>([
      ["id-board-0", { state: "running", final: false }],
      ["id-board-1", { state: "dead", final: true }],
      ["id-finish", { state: "cancelled", final: true }],
    ]);
    const client = queue.client as unknown as {
      cancel: (id: string) => Promise<void>;
      enqueue: (j: unknown) => Promise<{ id: string; duplicate: boolean }>;
      get: (id: string) => Promise<{ id: string; state: string; final: boolean }>;
    };
    client.cancel = async (id: string) => {
      cancelled.push(id);
      states.set(id, { state: "cancelled", final: true });
    };
    client.enqueue = async () => ({ id: "id-failed-finish", duplicate: false });
    client.get = async (id: string) => ({ id, ...(states.get(id) ?? { state: "completed", final: true }) });

    const work = WorkDir.create({ route: "story", body: story() });
    work.write("ids.json", { "board-0": "id-board-0", "board-1": "id-board-1", finish: "id-finish" });

    const priv = queue as unknown as {
      handle: (kind: string, job: unknown, signal: AbortSignal) => Promise<unknown>;
      failed: (workId: string, error: string) => Promise<void>;
    };
    const ac = new AbortController();
    const boardRun = priv.handle("board", { payload: { work: work.id, part: 0 } }, ac.signal);
    await boardEntered;

    await priv.failed(work.id, "scene 2 crashed");
    assert.ok(cancelled.includes("id-board-0"));
    await priv.handle("finish", { payload: { work: work.id, error: "scene 2 crashed" } }, ac.signal);

    assert.equal(work.exists, true);
    assert.equal(work.has("settled"), true);
    assert.equal(await queue.live(work), true);

    letBoardExit();
    await boardRun;
    assert.equal(dirExistedWhenBoardDone, true);
    assert.equal(work.exists, false);
  });

  test("SegmentCache pins cached scenes into work dir so eviction before story cannot cause a 404", async () => {
    const segDir = fs.mkdtempSync(path.join(output, "seg-cache-"));
    try {
      const cache = new SegmentCache(segDir, 1024 * 1024);
      const ffmpeg = new FfmpegDriver(cache, "stamp1");
      const render = { compositionId: "ExplainerScene", inputProps: { seconds: 2 } };
      const spec = {
        route: "story" as const,
        body: story({ scenes: [{ image: "", seconds: 2, key: "pinned-scene", render }] }),
      };
      const props = specs.storyProps(spec.body as never);
      const hash = (ffmpeg as unknown as { segmentHash: (p: unknown, s: unknown, i: number) => string }).segmentHash(
        props,
        props.scenes[0],
        0,
      );
      await cache.get(hash, async (out) => fs.writeFileSync(out, "cached-mp4-bytes"));

      const work = WorkDir.create(spec);
      const inputs = new Inputs(specs, ffmpeg);
      await inputs.fetch({ work, signal: new AbortController().signal });
      assert.equal(fs.existsSync(work.segment(0)), true);

      await CacheTrim.keep(segDir, 0);
      assert.equal(cache.has(hash), false);

      let boardRendered = false;
      const steps = new Steps(
        specs,
        {
          render: async () => {
            boardRendered = true;
          },
        },
        ffmpeg,
      );
      const res = await steps.render({ work, signal: new AbortController().signal, part: 0 });
      assert.deepEqual(res, { skipped: true });
      assert.equal(boardRendered, false);

      const job = specs.job(work.spec(), work);
      assert.equal(job.pinnedSegments?.[0], work.segment(0));
      assert.equal(fs.readFileSync(work.segment(0), "utf8"), "cached-mp4-bytes");
      work.remove();
    } finally {
      fs.rmSync(segDir, { recursive: true, force: true });
    }
  });

  test("RemotionDriver clears a rejected bundlePromise so subsequent renders recover", async () => {
    let calls = 0;
    const driver = new RemotionDriver({
      ensureBrowser: async () => {
        calls++;
        if (calls === 1) throw new Error("transient browser download failure");
      },
      bundle: async () => "http://127.0.0.1:9999/bundle",
    });
    await assert.rejects(() => driver.getBundle(), /transient browser download failure/);
    const url = await driver.getBundle();
    assert.equal(url, "http://127.0.0.1:9999/bundle");
    assert.equal(calls, 2);
  });

  test("CachingDriver hits across different work dirs with identical input files and writes atomically", async () => {
    const cacheDir = fs.mkdtempSync(path.join(output, "render-cache-"));
    try {
      let renders = 0;
      const inner: RenderDriver = {
        render: async (_job, out) => {
          renders++;
          fs.writeFileSync(out, `rendered-${renders}`);
        },
      };
      const driver = new CachingDriver(inner, cacheDir, "v1", 1024 * 1024, output);

      const w1 = WorkDir.create({ route: "caption", body: {} });
      const w2 = WorkDir.create({ route: "caption", body: {} });
      const f1 = path.join(w1.inputs, "aaa.mp4");
      const f2 = path.join(w2.inputs, "bbb.mp4");
      fs.writeFileSync(f1, "identical-clip-payload");
      fs.writeFileSync(f2, "identical-clip-payload");

      const u1 = specs.media.url(specs.media.rel(f1));
      const u2 = specs.media.url(specs.media.rel(f2));
      assert.notEqual(u1, u2);

      await driver.render({ compositionId: "CaptionedClip", inputProps: { src: u1, fps: 30 } }, w1.out);
      await driver.render({ compositionId: "CaptionedClip", inputProps: { src: u2, fps: 30 } }, w2.out);

      assert.equal(renders, 1);
      assert.equal(fs.readFileSync(w2.out, "utf8"), "rendered-1");
      assert.equal(
        fs.readdirSync(cacheDir).some((n) => n.endsWith(".part.mp4")),
        false,
      );
      w1.remove();
      w2.remove();
    } finally {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  test("Steps.render defers started notice on board sub-steps and retries transient start callback errors", async () => {
    const prevDelays = Steps.START_RETRY_MS;
    Steps.START_RETRY_MS = [10, 20];
    let attempts = 0;
    const server = http.createServer((_req, res) => {
      attempts++;
      if (attempts === 1) {
        res.statusCode = 502;
        res.end("bad gateway");
        return;
      }
      res.end("{}");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const callbackUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/cb`;
    try {
      const render = { compositionId: "ExplainerScene", inputProps: { seconds: 1 } };
      const spec = {
        route: "story" as const,
        body: story({ callbackUrl, scenes: [{ image: "", seconds: 1, key: "k", render }] }),
      };
      const work = WorkDir.create(spec);
      const driver = { render: async (_job: unknown, out: string) => fs.writeFileSync(out, "mp4") };
      const steps = new Steps(specs, driver, { cached: () => false } as unknown as FfmpegDriver);
      const signal = new AbortController().signal;

      await steps.render({ work, signal, part: 0 });
      await new Promise((r) => setTimeout(r, 40));
      assert.equal(attempts, 0);
      assert.equal(work.has("started"), false);

      await steps.render({ work, signal });
      await new Promise((r) => setTimeout(r, 80));
      assert.equal(attempts, 2);
      assert.equal(work.has("started"), true);
      work.remove();
    } finally {
      Steps.START_RETRY_MS = prevDelays;
      server.close();
    }
  });

  test("Settle holds cursor on transient ended() failure and aborts idle sleep promptly", async () => {
    const prevIdle = Settle.IDLE_MS;
    Settle.IDLE_MS = 10_000;
    const cursorFile = path.join(WorkDir.root, ".cursor");
    fs.rmSync(cursorFile, { force: true });
    const ac = new AbortController();
    let getCalls = 0;
    let listCalls = 0;
    const fakeClient = {
      namespace: "editor",
      rpc: {
        jobs: {
          listEvents: async ({ after }: { after: bigint }) => {
            listCalls++;
            if (listCalls === 1) {
              assert.equal(after, 0n);
              return { events: [{ seq: 7n, jobId: "j1", queue: "board", state: State.DEAD }] };
            }
            if (listCalls === 2) {
              assert.equal(after, 0n);
              return { events: [{ seq: 7n, jobId: "j1", queue: "board", state: State.DEAD }] };
            }
            assert.equal(after, 7n);
            setTimeout(() => ac.abort(), 10);
            return { events: [] };
          },
        },
      },
      get: async () => {
        getCalls++;
        if (getCalls === 1) throw new Error("transient network blip");
        return { kind: "board", state: "dead", payload: { work: WorkDir.create({ route: "story", body: story() }).id }, errors: [] };
      },
    };
    const settled: string[] = [];
    const settle = new Settle(fakeClient as never, async (work) => {
      settled.push(work);
      WorkDir.open(work).remove();
    });
    try {
      Settle.IDLE_MS = 20;
      const started = Date.now();
      await settle.run(ac.signal);
      assert.equal(settled.length, 1);
      assert.equal(fs.readFileSync(cursorFile, "utf8"), "7");
      assert.ok(Date.now() - started < 2_000);
    } finally {
      Settle.IDLE_MS = prevIdle;
      fs.rmSync(cursorFile, { force: true });
    }
  });

  test("RunnelQueue.settings patches existing queues, pools, and schedules when env changes", async () => {
    const queue = new RunnelQueue({ url: "http://127.0.0.1:1", namespace: "editor", token: "" }, handlers());
    const patched: { kind: string; name: string; paths: string[] }[] = [];
    const alreadyExists = Object.assign(new Error("exists"), { code: Code.AlreadyExists });
    const cfg = queue.client.rpc.config as unknown as Record<string, (req: Record<string, unknown>) => Promise<unknown>>;
    cfg.putQueue = async () => {
      throw alreadyExists;
    };
    cfg.putPool = async () => {
      throw alreadyExists;
    };
    cfg.putSchedule = async () => {
      throw alreadyExists;
    };
    cfg.patchQueue = async (req) => {
      patched.push({
        kind: "queue",
        name: (req.queue as { name: string }).name,
        paths: (req.updateMask as { paths: string[] }).paths,
      });
      return {};
    };
    cfg.patchPool = async (req) => {
      patched.push({
        kind: "pool",
        name: (req.pool as { name: string }).name,
        paths: (req.updateMask as { paths: string[] }).paths,
      });
      return {};
    };
    cfg.patchSchedule = async (req) => {
      patched.push({
        kind: "schedule",
        name: (req.schedule as { name: string }).name,
        paths: (req.updateMask as { paths: string[] }).paths,
      });
      return {};
    };
    await (queue as unknown as { settings: () => Promise<void> }).settings();
    assert.ok(patched.some((p) => p.kind === "pool" && p.name === "chromium" && p.paths.includes("slots")));
    assert.ok(patched.some((p) => p.kind === "queue" && p.name === "board" && p.paths.includes("max_running")));
    assert.ok(patched.some((p) => p.kind === "schedule" && p.name === "sweep" && p.paths.includes("spec")));
  });

  test("RunnelQueue.later does not clobber a started prewarm and live() respects delayed start jobs", async () => {
    const queue = new RunnelQueue({ url: "http://127.0.0.1:1", namespace: "editor", token: "" }, handlers());
    const first = WorkDir.create({ route: "prewarm", body: story({ marker: "localized" }) });
    const second = WorkDir.create({ route: "prewarm", body: story({ marker: "late-raw" }) });
    const flow = specs.flow({ route: "prewarm", body: story() });

    let startState = { state: "scheduled", final: false };
    const client = queue.client as unknown as {
      enqueue: () => Promise<{ id: string; duplicate: boolean }>;
      get: () => Promise<{ id: string; state: string; final: boolean; payload: { work: string } }>;
    };
    client.enqueue = async () => ({ id: "start-1", duplicate: false });
    client.get = async () => ({ id: "start-1", ...startState, payload: { work: first.id } });

    await queue.later(first, flow, { key: "prewarm:p1", delayMs: 900_000 });
    assert.equal(first.has("start.json"), true);
    const old = new Date(Date.now() - RunnelQueue.UNSENT_MS - 60_000);
    fs.utimesSync(first.dir, old, old);
    assert.equal(await queue.live(first), true);

    first.claim("starting");
    startState = { state: "running", final: false };
    client.enqueue = async () => ({ id: "start-1", duplicate: true });
    await queue.later(second, flow, { key: "prewarm:p1", delayMs: 900_000 });
    assert.equal((first.spec().body as { marker: string }).marker, "localized");
    assert.equal(second.exists, false);
    first.remove();
  });
});
