/** A scene as the music bed sees it: how long it runs and whether it has sound of its own. */
type BedScene = { seconds: number; audio?: string; video_audio?: boolean; joined?: boolean };

export class ScenePause {
  /** The pause after a scene: none when the next scene goes on from where its clip ends. */
  static after(scene: { joined?: boolean }, gap: number): number {
    return scene.joined ? 0 : Math.max(0, gap);
  }
}

/** A span of the film, in seconds, where a scene speaks (its voice or its clip's sound). */
export type Spoken = readonly [start: number, end: number];

/**
 * The music bed's level over a story: it dips under every scene that speaks, comes back
 * up in the gaps and fades out at the end. One curve for the Remotion preview and the
 * ffmpeg render, so both mix the same way.
 */
export class MusicBed {
  /** Bed level between lines, and under a voice, when the caller sends none. */
  static readonly LEVEL = 0.35;
  static readonly UNDER_VOICE = 0.12;
  /** Seconds the bed takes to dip before a line and to rise after it. */
  static readonly RAMP = 0.25;
  static readonly FADE_OUT = 1.5;

  static spoken(scenes: BedScene[], gap: number): Spoken[] {
    const out: Spoken[] = [];
    let at = 0;
    for (const scene of scenes) {
      const seconds = scene.seconds || 1;
      if (scene.audio || scene.video_audio) out.push([at, at + seconds]);
      at += seconds + ScenePause.after(scene, gap);
    }
    return out;
  }

  static length(scenes: BedScene[], gap: number): number {
    return scenes.reduce((sum, s) => sum + (s.seconds || 1) + ScenePause.after(s, gap), 0);
  }

  /** The bed's volume at `t` seconds. */
  static gain(t: number, spoken: Spoken[], total: number, level: number, under: number): number {
    const r = MusicBed.RAMP;
    let duck = 0;
    for (const [a, b] of spoken) {
      duck = Math.max(duck, MusicBed.clamp(Math.min((t - a + r) / r, (b + r - t) / r)));
    }
    const fade = MusicBed.clamp((total - t) / MusicBed.FADE_OUT);
    return (level - (level - under) * duck) * fade;
  }

  /** The same curve as an ffmpeg `volume` expression over `t` (use with eval=frame). */
  static expression(spoken: Spoken[], total: number, level: number, under: number): string {
    const r = MusicBed.RAMP;
    const n = (x: number) => `(${x.toFixed(3)})`;
    const duck =
      spoken
        .map(([a, b]) => `clip(min((t-${n(a - r)})/${r},(${n(b + r)}-t)/${r}),0,1)`)
        .reduce((acc, dip) => (acc ? `max(${acc},${dip})` : dip), "") || "0";
    const fade = `clip((${n(total)}-t)/${MusicBed.FADE_OUT},0,1)`;
    return `(${n(level)}-${n(level - under)}*${duck})*${fade}`;
  }

  private static clamp(x: number): number {
    return Math.min(1, Math.max(0, x));
  }
}
