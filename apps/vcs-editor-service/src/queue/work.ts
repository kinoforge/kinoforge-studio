import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type Route = "story" | "prewarm" | "board" | "caption";

export interface Spec {
  route: Route;
  body: Record<string, unknown>;
}

export class WorkDir {
  static root = "";

  private constructor(readonly id: string) {}

  static use(outputDir: string): void {
    WorkDir.root = path.join(outputDir, "work");
    fs.mkdirSync(WorkDir.root, { recursive: true });
  }

  static create(spec: Spec): WorkDir {
    const work = new WorkDir(randomUUID());
    fs.mkdirSync(work.inputs, { recursive: true });
    work.write("spec.json", spec);
    return work;
  }

  static open(id: unknown): WorkDir {
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) throw new Error(`bad work id ${String(id)}`);
    return new WorkDir(id);
  }

  static ids(): string[] {
    try {
      return fs.readdirSync(WorkDir.root).filter((n) => /^[0-9a-f-]{36}$/.test(n));
    } catch {
      return [];
    }
  }

  get dir(): string {
    return path.join(WorkDir.root, this.id);
  }

  get inputs(): string {
    return path.join(this.dir, "in");
  }

  get out(): string {
    return path.join(this.dir, "out.mp4");
  }

  part(index: number): string {
    return path.join(this.dir, `part-${index}.mp4`);
  }

  segment(index: number): string {
    return path.join(this.dir, `seg-${index}.mp4`);
  }

  get exists(): boolean {
    return fs.existsSync(this.dir);
  }

  ageMs(): number {
    try {
      return Date.now() - fs.statSync(this.dir).mtimeMs;
    } catch {
      return Infinity;
    }
  }

  spec(): Spec {
    return this.read("spec.json") as Spec;
  }

  read(name: string): unknown {
    return JSON.parse(fs.readFileSync(path.join(this.dir, name), "utf8"));
  }

  has(name: string): boolean {
    return fs.existsSync(path.join(this.dir, name));
  }

  write(name: string, value: unknown): void {
    const file = path.join(this.dir, name);
    const part = `${file}.${randomUUID()}.part`;
    fs.writeFileSync(part, JSON.stringify(value));
    fs.renameSync(part, file);
  }

  claim(name: string): boolean {
    try {
      fs.writeFileSync(path.join(this.dir, name), "", { flag: "wx" });
      return true;
    } catch {
      return false;
    }
  }

  remove(): void {
    fs.rmSync(this.dir, { recursive: true, force: true });
  }
}
