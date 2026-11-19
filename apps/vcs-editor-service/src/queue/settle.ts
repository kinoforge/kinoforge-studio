import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { type Client, RunnelError } from "@kinoforge/runnel";
import { State } from "@kinoforge/runnel/rpc";
import { Lanes } from "./lanes.ts";
import { Failure } from "./queue.ts";
import { WorkDir } from "./work.ts";

const ENDED = new Set([State.DEAD, State.CANCELLED, State.EXPIRED]);
const OURS = new Set(Lanes.ALL.map((l) => l.queue));

export class Settle {
  static IDLE_MS = Number(process.env.SETTLE_IDLE_MS) || 2000;

  constructor(
    private readonly client: Client,
    private readonly failed: (work: string, error: string) => Promise<void>,
    private readonly drop: (work: string) => Promise<void> = async (work) => {
      WorkDir.open(work).remove();
    },
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

  private saveCursor(after: bigint): void {
    const file = this.cursorFile;
    const part = `${file}.${randomUUID()}.part`;
    fs.writeFileSync(part, String(after));
    fs.renameSync(part, file);
  }

  private static sleep(ms: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.resolve();
    return new Promise((resolve) => {
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      signal.addEventListener("abort", onAbort, { once: true });
    });
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
      let retry = false;
      for (const event of events) {
        if (signal.aborted) return;
        if (OURS.has(event.queue) && ENDED.has(event.state)) {
          const settled = await this.ended(event.jobId);
          if (!settled) {
            retry = true;
            break;
          }
        }
        after = event.seq;
        this.saveCursor(after);
      }
      if (events.length === 0 || retry) await Settle.sleep(Settle.IDLE_MS, signal);
    }
  }

  private async ended(id: string): Promise<boolean> {
    try {
      const job = await this.client.get(id);
      const { work, error } = job.payload as { work?: string; error?: string };
      if (!work) return true;
      if (job.kind === "finish") {
        if (error !== undefined || job.state !== "cancelled") await this.drop(work);
        return true;
      }
      const why = job.errors.at(-1)?.error || `the ${job.kind} step ${job.state}`;
      await this.failed(work, why);
      return true;
    } catch (e) {
      if (e instanceof RunnelError && e.reason === "not_found") return true;
      if (e instanceof Error && e.message.startsWith("bad work id ")) return true;
      console.error(`settling job ${id} failed:`, Failure.text(e));
      return false;
    }
  }
}
