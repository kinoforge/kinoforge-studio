import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import type { FfmpegDriver } from "../src/ffmpeg-driver.ts";
import { LocalQueue } from "../src/queue/local-queue.ts";
import type { Handlers, StepContext } from "../src/queue/queue.ts";
import { RunnelQueue } from "../src/queue/runnel-queue.ts";
import { WorkDir } from "../src/queue/work.ts";
import { Media, RenderSpecs } from "../src/render-specs.ts";
import { Inputs } from "../src/workers/inputs.ts";
import { Upkeep } from "../src/workers/upkeep.ts";

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
});
