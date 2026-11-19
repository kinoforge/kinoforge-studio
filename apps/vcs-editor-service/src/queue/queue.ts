import type { ChoreKind, FlowKind } from "./lanes.ts";
import type { WorkDir } from "./work.ts";

export interface FlowStep {
  name: string;
  kind: FlowKind;
  after: string[];
  part?: number;
}

export interface Flow {
  steps: FlowStep[];
  meta: Record<string, string>;
  priority?: number;
}

export interface Later {
  key: string;
  delayMs: number;
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
  part?: number;
  keepWork?: boolean;
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
  later(work: WorkDir, flow: Flow, later: Later): Promise<void>;
}

export class FlowSteps {
  static chain(kinds: FlowKind[], from: FlowStep[] = []): FlowStep[] {
    const steps = [...from];
    for (const kind of kinds) {
      const ends = steps.filter((s) => !steps.some((o) => o.after.includes(s.name))).map((s) => s.name);
      steps.push({ name: kind, kind, after: ends });
    }
    return steps;
  }
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
