import fs from "node:fs";
import path from "node:path";
import type { Client } from "@kinoforge/runnel";
import { State } from "@kinoforge/runnel/rpc";
import { Lanes } from "./lanes.ts";
import { Failure } from "./queue.ts";
import { WorkDir } from "./work.ts";

const ENDED = new Set([State.DEAD, State.CANCELLED, State.EXPIRED]);
const OURS = new Set(Lanes.ALL.map((l) => l.queue));

export class Settle {
  static readonly IDLE_MS = Number(process.env.SETTLE_IDLE_MS) || 2000;

  constructor(
    private readonly client: Client,
    private readonly failed: (work: string, error: string) => Promise<void>,
  ) {}

  private get cursorFile(): string {
    return path.join(WorkDir.root, ".cursor");
  }

  private cursor(): bigint {
    try {
      return BigInt(fs.readFileSync(this.cursorFile, "utf8").trim() || "0");
    } catch {
      return 0n;
    }
  }

  async run(signal: AbortSignal): Promise<void> {
    let after = this.cursor();
    while (!signal.aborted) {
      let events: { seq: bigint; jobId: string; queue: string; state: State }[] = [];
      try {
        events = (
          await this.client.rpc.jobs.listEvents({ namespace: this.client.namespace, after, limit: 100 }, { signal })
        ).events;
      } catch (e) {
        if (!signal.aborted) console.error("runnel events read failed:", e);
      }
      for (const event of events) {
        if (OURS.has(event.queue) && ENDED.has(event.state)) await this.ended(event.jobId);
        after = event.seq;
        fs.writeFileSync(this.cursorFile, String(after));
      }
      if (events.length === 0) await new Promise((wake) => setTimeout(wake, Settle.IDLE_MS));
    }
  }

  private async ended(id: string): Promise<void> {
    try {
      const job = await this.client.get(id);
      const { work, error } = job.payload as { work?: string; error?: string };
      if (!work) return;
      if (job.kind === "finish") {
        if (error !== undefined || job.state !== "cancelled") WorkDir.open(work).remove();
        return;
      }
      const why = job.errors.at(-1)?.error || `the ${job.kind} step ${job.state}`;
      await this.failed(work, why);
    } catch (e) {
      console.error(`settling job ${id} failed:`, Failure.text(e));
    }
  }
}
