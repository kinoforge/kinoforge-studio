export interface Panel {
  x: number;
  y: number;
  w: number;
  h: number;
  start: number;
  end: number;
}

export interface View {
  cx: number;
  cy: number;
  zoom: number;
}

export class WbCamera {
  static readonly GAP = 0.14;
  static readonly LEAD = 0.45;
  static readonly MOVE = 1.0;
  static readonly DIP = 0.2;
  static readonly DRIFT = 0.03;
  static readonly OUTRO = 3.2;
  static readonly PULL = 1.8;

  static panels(times: readonly { start: number; end: number }[], w: number, h: number): Panel[] {
    const cols = Math.min(times.length, w >= h ? 3 : 2);
    return times.map((time, i) => ({
      x: (i % cols) * w * (1 + WbCamera.GAP),
      y: Math.floor(i / cols) * h * (1 + WbCamera.GAP),
      w,
      h,
      ...time,
    }));
  }

  static bounds(panels: readonly Panel[]) {
    const x = Math.min(...panels.map((p) => p.x));
    const y = Math.min(...panels.map((p) => p.y));
    const right = Math.max(...panels.map((p) => p.x + p.w));
    const bottom = Math.max(...panels.map((p) => p.y + p.h));
    return { x, y, w: right - x, h: bottom - y };
  }

  static at(t: number, panels: readonly Panel[], w: number, h: number): View {
    const hold = (i: number, time: number): View => {
      const p = panels[i];
      const share = Math.min(1, Math.max(0, (time - p.start) / Math.max(0.1, p.end - p.start)));
      return { cx: p.x + p.w / 2, cy: p.y + p.h / 2, zoom: 1 + WbCamera.DRIFT * WbCamera.soft(share) };
    };
    const last = panels.length - 1;
    const end = panels[last].end;
    if (t >= end) {
      const box = WbCamera.bounds(panels);
      const wide: View = {
        cx: box.x + box.w / 2,
        cy: box.y + box.h / 2,
        zoom: Math.min(w / box.w, h / box.h) * 0.9,
      };
      const from = hold(last, end);
      const p = WbCamera.soft(Math.min(1, (t - end) / WbCamera.PULL));
      return WbCamera.mix(from, wide, p, 0);
    }
    let i = panels.findIndex((p) => t < p.end);
    if (i < 0) i = last;
    const next = panels[i + 1];
    if (next && t > next.start - WbCamera.LEAD) {
      const p = WbCamera.soft((t - (next.start - WbCamera.LEAD)) / WbCamera.MOVE);
      return WbCamera.mix(hold(i, next.start - WbCamera.LEAD), hold(i + 1, next.start), p, WbCamera.DIP);
    }
    if (i > 0 && t < panels[i].start + WbCamera.MOVE - WbCamera.LEAD) {
      const p = WbCamera.soft((t - (panels[i].start - WbCamera.LEAD)) / WbCamera.MOVE);
      return WbCamera.mix(hold(i - 1, panels[i].start - WbCamera.LEAD), hold(i, panels[i].start), p, WbCamera.DIP);
    }
    return hold(i, t);
  }

  static settle(i: number): number {
    return i === 0 ? 0.2 : WbCamera.MOVE - WbCamera.LEAD + 0.05;
  }

  private static mix(a: View, b: View, p: number, dip: number): View {
    return {
      cx: a.cx + (b.cx - a.cx) * p,
      cy: a.cy + (b.cy - a.cy) * p,
      zoom: (a.zoom + (b.zoom - a.zoom) * p) * (1 - dip * Math.sin(Math.PI * p)),
    };
  }

  static soft(x: number): number {
    const c = Math.min(1, Math.max(0, x));
    return c * c * c * (c * (c * 6 - 15) + 10);
  }
}
