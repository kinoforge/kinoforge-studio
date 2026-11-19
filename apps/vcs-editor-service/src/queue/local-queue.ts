import { type ChoreKind, type StepKind, Lanes } from "./lanes.ts";
import {
  type Chores,
  Failure,
  type Flow,
  type FlowRun,
  type Handlers,
  type Outcome,
  type RenderQueue,
} from "./queue.ts";
import { WorkDir } from "./work.ts";

export class Limiter {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(readonly size: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.size) await new Promise<void>((go) => this.waiting.push(go));
    else this.active++;
    try {
      return await task();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }
}

export class LocalQueue implements RenderQueue {
  readonly name = "local";
  private readonly limits = new Map<string, Limiter>();
  private readonly active = new Set<string>();
  private readonly busy = new Set<string>();

  constructor(private readonly handlers: Handlers) {}

  async start(signal: AbortSignal, chores: Chores): Promise<void> {
    for (const id of WorkDir.ids()) WorkDir.open(id).remove();
    for (const chore of Lanes.CHORES) {
      const timer = setInterval(() => void this.chore(chore.kind, chores, signal), chore.everyMinutes * 60_000);
      signal.addEventListener("abort", () => clearInterval(timer), { once: true });
    }
  }

  async drained(): Promise<void> {}

  async live(work: WorkDir): Promise<boolean> {
    return this.active.has(work.id);
  }

  async heal(): Promise<void> {}

  async stats(): Promise<Record<string, unknown>> {
    return { running: this.active.size };
  }

  async submit(work: WorkDir, flow: Flow): Promise<FlowRun> {
    const abort = new AbortController();
    this.active.add(work.id);
    const done = this.run(work, flow, abort.signal).finally(() => this.active.delete(work.id));
    return { done, cancel: async () => abort.abort(new Error("cancelled")) };
  }

  private async chore(kind: ChoreKind, chores: Chores, signal: AbortSignal): Promise<void> {
    if (this.busy.has(kind) || signal.aborted) return;
    this.busy.add(kind);
    try {
      await this.step(kind, () => chores[kind](signal));
    } catch (e) {
      console.error(`${kind} failed:`, e);
    } finally {
      this.busy.delete(kind);
    }
  }

  private async run(work: WorkDir, flow: Flow, signal: AbortSignal): Promise<Outcome> {
    let error: string | undefined;
    try {
      for (const kind of flow.steps.filter((k) => k !== "finish")) {
        signal.throwIfAborted();
        await this.step(kind, () => this.handlers[kind]({ work, signal }));
      }
    } catch (e) {
      error = Failure.text(e);
    }
    try {
      return (await this.step("finish", () => this.handlers.finish({ work, signal, error }))) as Outcome;
    } catch (e) {
      console.error("render finish failed:", e);
      return { ok: false, error: error ?? Failure.text(e) };
    } finally {
      work.remove();
    }
  }

  private step<T>(kind: StepKind, task: () => Promise<T>): Promise<T> {
    const lane = Lanes.of(kind);
    const pool = Lanes.pool(lane.pool);
    const key = pool ? `pool:${pool.name}` : lane.queue;
    let limiter = this.limits.get(key);
    if (!limiter) {
      limiter = new Limiter(pool ? pool.slots : lane.concurrency);
      this.limits.set(key, limiter);
    }
    return limiter.run(task);
  }
}
