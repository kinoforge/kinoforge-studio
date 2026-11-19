import { busy, Client, Code, type FlowStep, type Job, RunnelError, Worker } from "@kinoforge/runnel";
import { type ChoreKind, type FlowKind, type StepKind, Lanes } from "./lanes.ts";
import {
  type Chores,
  Failure,
  type Flow,
  type FlowRun,
  type Handlers,
  type Later,
  NoRoom,
  type Outcome,
  type RenderQueue,
} from "./queue.ts";
import { Settle } from "./settle.ts";
import { WorkDir } from "./work.ts";

export interface RunnelConfig {
  url: string;
  namespace: string;
  token: string;
}

interface Payload {
  work: string;
  error?: string;
  part?: number;
}

const BROKEN = new Set(["dead", "expired", "cancelled"]);

export class RunnelQueue implements RenderQueue {
  static readonly UNSENT_MS = 600_000;
  readonly name = "runnel";
  readonly client: Client;
  private readonly running: Promise<void>[] = [];

  constructor(
    config: RunnelConfig,
    private readonly handlers: Handlers,
  ) {
    this.client = new Client(config);
  }

  static fromEnv(handlers: Handlers): RunnelQueue | null {
    const url = process.env.RUNNEL_URL || "";
    if (!url) return null;
    return new RunnelQueue(
      { url, namespace: process.env.RUNNEL_NAMESPACE || "editor", token: process.env.RUNNEL_KEY || "" },
      handlers,
    );
  }

  async start(signal: AbortSignal, chores: Chores): Promise<void> {
    await this.settings();
    const chore = (kind: StepKind): kind is ChoreKind => Lanes.CHORES.some((c) => c.kind === kind);
    for (const lane of Lanes.ALL) {
      const worker = new Worker(this.client, { queues: [lane.queue], concurrency: lane.concurrency });
      for (const kind of lane.kinds) {
        worker.handle(kind, (job, ctx) => {
          if (chore(kind)) return chores[kind](ctx.signal);
          if (kind === "start") return this.begin(WorkDir.open((job.payload as Payload).work));
          return this.handle(kind as FlowKind, job, ctx.signal);
        });
      }
      this.running.push(worker.run(signal).catch((e) => console.error(`runnel worker ${lane.queue} stopped:`, e)));
    }
    const settle = new Settle(this.client, (work, error) => this.failed(work, error));
    this.running.push(settle.run(signal).catch((e) => console.error("runnel settle stopped:", e)));
  }

  async drained(): Promise<void> {
    await Promise.all(this.running);
  }

  async stats(): Promise<Record<string, unknown>> {
    return this.client.stats();
  }

  async submit(work: WorkDir, flow: Flow): Promise<FlowRun> {
    const ids = await this.enqueue(work, flow);
    const stop = new AbortController();
    return {
      done: this.outcome(
        ids,
        flow.steps.map((s) => s.name),
        stop.signal,
      ),
      cancel: async () => {
        stop.abort();
        await Promise.all(Object.values(ids).map((id) => this.client.cancel(id).catch(() => undefined)));
      },
    };
  }

  async later(work: WorkDir, flow: Flow, { key, delayMs }: Later): Promise<void> {
    work.write("flow.json", flow);
    const made = await this.client.enqueue({
      ...this.job("start", { work: work.id }, flow),
      delayMs,
      uniqueKey: key,
      uniqueForMs: delayMs,
    });
    if (!made.duplicate) return;
    const kept = (await this.find(made.id))?.payload as Payload | undefined;
    if (kept?.work && kept.work !== work.id) {
      const first = WorkDir.open(kept.work);
      if (first.exists) first.write("spec.json", work.spec());
    }
    if (kept?.work !== work.id) work.remove();
  }

  private async begin(work: WorkDir): Promise<{ steps: number }> {
    if (!work.has("ids.json")) await this.enqueue(work, work.read("flow.json") as Flow);
    return { steps: Object.keys(work.read("ids.json") as object).length };
  }

  private async enqueue(work: WorkDir, flow: Flow): Promise<Record<string, string>> {
    const steps: Record<string, FlowStep> = {};
    for (const step of flow.steps) {
      const payload = { work: work.id, ...(step.part !== undefined ? { part: step.part } : {}) };
      steps[step.name] = { job: this.job(step.kind, payload, flow), after: step.after };
    }
    const made = await this.client.enqueueFlow(steps);
    const ids = Object.fromEntries(Object.entries(made).map(([name, r]) => [name, r.id]));
    work.write("ids.json", ids);
    return ids;
  }

  async live(work: WorkDir): Promise<boolean> {
    if (!work.has("ids.json")) return work.ageMs() < RunnelQueue.UNSENT_MS;
    const ids = work.read("ids.json") as Record<string, string>;
    const finish = await this.find(ids.finish);
    return finish !== null && (!finish.final || finish.state === "cancelled");
  }

  async heal(work: WorkDir): Promise<void> {
    if (!work.has("ids.json")) return;
    const ids = work.read("ids.json") as Record<string, string>;
    for (const [kind, id] of Object.entries(ids)) {
      const step = await this.find(id);
      if (!step || !BROKEN.has(step.state)) continue;
      if (kind === "finish" && step.state !== "cancelled") return;
      await this.failed(work.id, step.errors.at(-1)?.error || `the ${kind} step ${step.state}`);
      return;
    }
  }

  private async find(id: string | undefined): Promise<Job | null> {
    if (!id) return null;
    try {
      return await this.client.get(id);
    } catch (e) {
      if (e instanceof RunnelError && e.reason === "not_found") return null;
      throw e;
    }
  }

  private job(kind: StepKind, payload: Payload, flow: Flow) {
    const lane = Lanes.of(kind);
    return {
      queue: lane.queue,
      kind,
      payload,
      maxAttempts: lane.attempts,
      timeoutMs: lane.timeoutMs,
      meta: flow.meta,
      ...(lane.pool ? { pool: lane.pool } : {}),
      ...(flow.priority ? { priority: flow.priority } : {}),
    };
  }

  private async failed(work: string, error: string): Promise<void> {
    await this.client.enqueue({
      ...this.job("finish", { work, error }, { steps: [], meta: { failed: "true" } }),
      uniqueKey: `failed:${work}`,
      uniqueForMs: 86_400_000,
    });
  }

  private async handle(kind: FlowKind, job: Job, signal: AbortSignal): Promise<unknown> {
    const payload = job.payload as Payload;
    try {
      const work = WorkDir.open(payload.work);
      return await this.handlers[kind]({ work, signal, error: payload.error, part: payload.part });
    } catch (e) {
      if (e instanceof NoRoom) throw busy(e.retryMs);
      throw e;
    }
  }

  private async outcome(ids: Record<string, string>, order: string[], signal: AbortSignal): Promise<Outcome> {
    try {
      const last = await this.client.wait(ids.finish, { signal });
      if (last.state === "completed") return last.result as Outcome;
      for (const name of order) {
        const step = await this.client.get(ids[name]);
        const error = step.errors.at(-1)?.error;
        if (step.state !== "completed" && step.state !== "cancelled") {
          return { ok: false, error: error || `the ${name} step ${step.state}` };
        }
      }
      return { ok: false, error: "the render was cancelled" };
    } catch (e) {
      return { ok: false, error: Failure.text(e) };
    }
  }

  private async settings(): Promise<void> {
    const namespace = this.client.namespace;
    const create = { precondition: { ifNoneMatch: true } };
    const chores = Lanes.of("sweep").queue;
    const writes = [
      ...Lanes.ALL.map((lane) =>
        this.client.rpc.config.putQueue({
          namespace,
          queue: { name: lane.queue, maxRunning: lane.concurrency, maxAttempts: lane.attempts },
          ...create,
        }),
      ),
      ...Lanes.POOLS.map((pool) =>
        this.client.rpc.config.putPool({ namespace, pool: { name: pool.name, slots: pool.slots }, ...create }),
      ),
      ...Lanes.CHORES.map((c) =>
        this.client.rpc.config.putSchedule({
          namespace,
          schedule: {
            name: c.kind,
            spec: `@every ${c.everyMinutes}m`,
            queue: chores,
            kind: c.kind,
            maxAttempts: 1,
            overlap: "skip",
            meta: { chore: c.kind },
          },
          ...create,
        }),
      ),
    ];
    for (const result of await Promise.allSettled(writes)) {
      if (result.status === "fulfilled") continue;
      const code = (result.reason as { code?: Code }).code;
      if (code !== Code.Aborted && code !== Code.AlreadyExists) throw result.reason;
    }
  }
}
