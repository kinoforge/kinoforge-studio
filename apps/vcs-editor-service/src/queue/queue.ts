import type { ChoreKind, FlowKind } from "./lanes.ts";
import type { WorkDir } from "./work.ts";

export interface Flow {
  steps: FlowKind[];
  meta: Record<string, string>;
  priority?: number;
}

export interface Outcome {
  ok: boolean;
  file?: string;
  error?: string;
}

export interface StepContext {
  work: WorkDir;
  signal: AbortSignal;
  error?: string;
}

export type StepHandler = (ctx: StepContext) => Promise<unknown>;

export type Handlers = Record<FlowKind, StepHandler>;

export type Chores = Record<ChoreKind, (signal: AbortSignal) => Promise<unknown>>;

export interface FlowRun {
  done: Promise<Outcome>;
  cancel(): Promise<void>;
}

export interface RenderQueue {
  readonly name: string;
  start(signal: AbortSignal, chores: Chores): Promise<void>;
  drained(): Promise<void>;
  live(work: WorkDir): Promise<boolean>;
  heal(work: WorkDir): Promise<void>;
  stats(): Promise<Record<string, unknown>>;
  submit(work: WorkDir, flow: Flow): Promise<FlowRun>;
}

export class NoRoom extends Error {
  constructor(
    message: string,
    readonly retryMs: number,
  ) {
    super(message);
  }
}

export class Failure {
  static text(e: unknown): string {
    return String(e instanceof Error ? e.message : e).slice(0, 500);
  }
}
