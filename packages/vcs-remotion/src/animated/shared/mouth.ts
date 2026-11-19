import type { CaptionWord } from "../../captions.ts";

export class SpeechMouth {
  static open(words: readonly CaptionWord[], t: number, baseRate = 14): number {
    const word = words.find((entry) => t >= entry.start && t < entry.end);
    if (!word) return 0;
    const rate = baseRate + (word.word.length % 4) * 2;
    const pulse = Math.max(0, Math.sin((t - word.start) * rate));
    return pulse > 0 ? Math.pow(pulse, 0.75) : 0;
  }
}
