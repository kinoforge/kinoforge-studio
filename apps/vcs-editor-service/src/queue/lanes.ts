export type StepKind =
  | "fetch"
  | "story"
  | "prewarm"
  | "board"
  | "caption"
  | "upload"
  | "finish"
  | ChoreKind;

export type ChoreKind = "sweep" | "doctor";

export type FlowKind = Exclude<StepKind, ChoreKind>;

export interface Lane {
  queue: string;
  kinds: StepKind[];
  concurrency: number;
  attempts: number;
  timeoutMs: number;
  pool?: string;
}

export interface Chore {
  kind: ChoreKind;
  everyMinutes: number;
}

export interface PoolLimit {
  name: string;
  slots: number;
}

function setting(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function lane(queue: string, kinds: StepKind[], defaults: Omit<Lane, "queue" | "kinds">): Lane {
  const prefix = `LANE_${queue.toUpperCase()}`;
  return {
    queue,
    kinds,
    concurrency: setting(`${prefix}_CONCURRENCY`, defaults.concurrency),
    attempts: setting(`${prefix}_ATTEMPTS`, defaults.attempts),
    timeoutMs: setting(`${prefix}_TIMEOUT_SECONDS`, defaults.timeoutMs / 1000) * 1000,
    ...(defaults.pool ? { pool: defaults.pool } : {}),
  };
}

export class Lanes {
  static readonly CHROMIUM = "chromium";

  static readonly ALL: readonly Lane[] = [
    lane("prepare", ["fetch"], { concurrency: 4, attempts: 5, timeoutMs: 600_000 }),
    lane("story", ["story", "prewarm"], { concurrency: 1, attempts: 3, timeoutMs: 3_600_000 }),
    lane("board", ["board"], { concurrency: 2, attempts: 3, timeoutMs: 1_800_000, pool: Lanes.CHROMIUM }),
    lane("caption", ["caption"], { concurrency: 2, attempts: 3, timeoutMs: 1_800_000, pool: Lanes.CHROMIUM }),
    lane("deliver", ["upload"], { concurrency: 2, attempts: 5, timeoutMs: 1_800_000 }),
    lane("notify", ["finish"], { concurrency: 4, attempts: 8, timeoutMs: 60_000 }),
    lane("chores", ["sweep", "doctor"], { concurrency: 1, attempts: 1, timeoutMs: 3_600_000 }),
  ];

  static readonly CHORES: readonly Chore[] = [
    { kind: "sweep", everyMinutes: setting("SWEEP_EVERY_MINUTES", 10) },
    { kind: "doctor", everyMinutes: setting("DOCTOR_EVERY_MINUTES", 5) },
  ];

  static readonly POOLS: readonly PoolLimit[] = [
    { name: Lanes.CHROMIUM, slots: setting("CHROMIUM_SLOTS", 2) },
  ];

  static of(kind: StepKind): Lane {
    const found = Lanes.ALL.find((l) => l.kinds.includes(kind));
    if (!found) throw new Error(`no lane runs ${kind}`);
    return found;
  }

  static pool(name: string | undefined): PoolLimit | undefined {
    return Lanes.POOLS.find((p) => p.name === name);
  }
}
