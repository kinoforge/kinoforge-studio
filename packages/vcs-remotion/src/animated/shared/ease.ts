export class Ease {
  static clamp(x: number): number {
    return Math.min(1, Math.max(0, x));
  }
  static out(t: number, duration: number, delay = 0): number {
    const x = Ease.clamp((t - delay) / Math.max(0.001, duration));
    return 1 - (1 - x) ** 3;
  }
  static inOut(t: number, duration: number, delay = 0): number {
    const x = Ease.clamp((t - delay) / Math.max(0.001, duration));
    return x * x * (3 - 2 * x);
  }
  static soft(t: number, duration: number, delay = 0): number {
    const x = Ease.clamp((t - delay) / Math.max(0.001, duration));
    return x * x * x * (x * (x * 6 - 15) + 10);
  }

  static pop(t: number, duration: number, delay = 0): number {
    const x = Ease.clamp((t - delay) / Math.max(0.001, duration));
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
  }
  static stagger(index: number, count: number, span: number): number {
    const step = Math.min(0.7, Math.max(0.25, (span * 0.75) / Math.max(1, count)));
    return 0.2 + index * step;
  }
}
