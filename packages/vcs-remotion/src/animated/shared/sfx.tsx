import { Audio, Sequence, useVideoConfig } from "remotion";

export type SfxKind = "pop" | "stamp" | "spark";

export interface SfxCue {
  at: number;
  kind: SfxKind;
  volume?: number;
}

export class Sfx {
  static readonly SAMPLE_RATE = 22050;
  static readonly VOLUMES: Record<SfxKind, number> = {
    pop: 0.12,
    stamp: 0.2,
    spark: 0.15,
  };
  private static readonly CACHE: Partial<Record<SfxKind, string>> = {};

  private static encodeWav(samples: Float32Array): string {
    const bytes = 44 + samples.length * 2;
    const buf = new ArrayBuffer(bytes);
    const view = new DataView(buf);
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    view.setUint32(4, bytes - 8, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, Sfx.SAMPLE_RATE, true);
    view.setUint32(28, Sfx.SAMPLE_RATE * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    const u8 = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return `data:audio/wav;base64,${btoa(bin)}`;
  }

  static uri(kind: SfxKind): string {
    const cached = Sfx.CACHE[kind];
    if (cached) return cached;
    const dur = kind === "pop" ? 0.065 : kind === "stamp" ? 0.11 : 0.14;
    const n = Math.floor(Sfx.SAMPLE_RATE * dur);
    const out = new Float32Array(n);
    let phase = 0;
    let phase2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / Sfx.SAMPLE_RATE;
      const p = i / n;
      const atk = Math.min(1, t / 0.004);
      if (kind === "pop") {
        const freq = 380 + 360 * p;
        phase += (2 * Math.PI * freq) / Sfx.SAMPLE_RATE;
        out[i] = Math.sin(phase) * atk * Math.exp(-p * 6) * 0.55;
      } else if (kind === "stamp") {
        const freq = 155 * Math.exp(-p * 2.2) + 48;
        phase += (2 * Math.PI * freq) / Sfx.SAMPLE_RATE;
        out[i] = Math.tanh(Math.sin(phase) * 1.4) * atk * Math.exp(-p * 5) * 0.7;
      } else {
        const freq1 = 880;
        const freq2 = 1320;
        phase += (2 * Math.PI * freq1) / Sfx.SAMPLE_RATE;
        phase2 += (2 * Math.PI * freq2) / Sfx.SAMPLE_RATE;
        out[i] = (0.55 * Math.sin(phase) + 0.45 * Math.sin(phase2)) * atk * Math.exp(-p * 5.2) * 0.45;
      }
    }
    const uri = Sfx.encodeWav(out);
    Sfx.CACHE[kind] = uri;
    return uri;
  }
}

export function SfxTrack({ cues, enabled }: { cues: readonly SfxCue[]; enabled?: boolean }) {
  const { fps, durationInFrames } = useVideoConfig();
  if (!enabled || !cues.length) return null;
  return (
    <>
      {cues.map((cue, idx) => {
        const from = Math.max(0, Math.round(cue.at * fps));
        if (from >= durationInFrames) return null;
        const frames = Math.min(durationInFrames - from, Math.ceil(0.2 * fps));
        if (frames <= 0) return null;
        return (
          <Sequence key={`${cue.kind}-${from}-${idx}`} from={from} durationInFrames={frames}>
            <Audio src={Sfx.uri(cue.kind)} volume={cue.volume ?? Sfx.VOLUMES[cue.kind]} />
          </Sequence>
        );
      })}
    </>
  );
}
