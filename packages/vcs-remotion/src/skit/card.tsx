import { BoardGlyph } from "../explainer/elements/glyph.tsx";
import { Ease } from "../explainer/pieces/ease.ts";
import { BOARD_FONT, type BoardPalette } from "../explainer/theme.ts";
import { FitText } from "../explainer/timeline.ts";
import type { CardField, CardKind } from "./spec.ts";
import type { CardState } from "./state.ts";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CardPlan {
  h: number;
  title: number;
  tags: Map<string, Box>;
  fieldsY: number;
}

export class CardLayout {
  static readonly MOVE = 0.45;
  static readonly BADGE_FADE = 0.35;

  static font(frame: number) {
    return frame * 0.042;
  }

  static plan(state: CardState, kind: CardKind, w: number, fs: number, fields: number): CardPlan {
    const pad = fs * 0.8;
    const title = fs * 1.2;
    const inner = w - pad * 2;
    const chip = fs * 0.82;
    const rowH = chip * 1.9;
    const tags = new Map<string, Box>();
    let x = 0;
    let row = 0;
    const top = pad + title * FitText.LEADING + fs * 0.5;
    for (const tag of state.tags) {
      if (kind === "checklist") {
        tags.set(tag, { x: pad, y: top + row * rowH, w: inner, h: rowH * 0.82 });
        row += 1;
        continue;
      }
      const cw = Math.min(inner, FitText.width(tag, chip) + chip * 1.4);
      if (x > 0 && x + cw > inner) {
        x = 0;
        row += 1;
      }
      tags.set(tag, { x: pad + x, y: top + row * rowH, w: cw, h: rowH * 0.78 });
      x += cw + chip * 0.45;
    }
    const rows = state.tags.length ? (kind === "checklist" ? row : row + 1) : 0;
    const fieldsY = top + rows * rowH + (rows ? fs * 0.2 : 0);
    const h = fieldsY + (fields ? fs * (kind === "score" ? 3.2 : 2.3) : 0) + pad * 0.6;
    return { h, title, tags, fieldsY };
  }
}

class FieldValue {
  static shown(before: number | string | undefined, after: number | string, p: number): string {
    if (typeof after === "number" && typeof before === "number") {
      const value = before + (after - before) * p;
      const whole = Number.isInteger(after) && Number.isInteger(before);
      return whole ? String(Math.round(value)) : value.toFixed(1);
    }
    return String(p < 0.5 && before !== undefined ? before : after);
  }
}

function KindGlyph({
  kind,
  size,
  color,
  tick = 1,
}: {
  kind: CardKind;
  size: number;
  color: string;
  tick?: number;
}) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" style={{ flex: "none" }}>
      {kind === "ticket" ? (
        <path
          d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-6Z"
          fill="none"
          stroke={color}
          strokeWidth={2.2}
        />
      ) : null}
      {kind === "checklist" ? (
        <g fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
          <rect x={3} y={3} width={18} height={18} rx={4} />
          {tick > 0 ? (
            <path
              d="M7.5 12.5l3 3 6-7"
              transform={`translate(12 12) scale(${tick}) translate(-12 -12)`}
            />
          ) : null}
        </g>
      ) : null}
      {kind === "score" ? (
        <path
          d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.8Z"
          fill={color}
        />
      ) : null}
    </svg>
  );
}

export function RunningCard({
  kind,
  icon,
  fields,
  before,
  after,
  changed,
  x,
  y,
  w,
  frame,
  opacity,
  palette,
  t,
  fade,
}: {
  kind: CardKind;
  icon?: string;
  fields: readonly CardField[];
  before: CardState;
  after: CardState;
  changed: number;
  x: number;
  y: number;
  w: number;
  frame: number;
  opacity: number;
  palette: BoardPalette;
  t: number;
  fade: number;
}) {
  const fs = CardLayout.font(frame);
  const p = changed >= 0 ? Ease.out(t, CardLayout.MOVE, changed) : 1;
  const old = CardLayout.plan(before, kind, w, fs, fields.length);
  const now = CardLayout.plan(after, kind, w, fs, fields.length);
  const h = old.h + (now.h - old.h) * p;
  const pad = fs * 0.8;
  const chip = fs * 0.82;
  const mix = (a: Box, b: Box): Box => ({
    x: a.x + (b.x - a.x) * p,
    y: a.y + (b.y - a.y) * p,
    w: a.w + (b.w - a.w) * p,
    h: a.h + (b.h - a.h) * p,
  });
  const tags = [...new Set([...before.tags, ...after.tags])];
  const titleSize = FitText.size(
    after.title,
    { w: w - pad * 3 - fs * 1.6, h: old.title * 1.4 },
    old.title,
    1,
  );
  const cell = (w - pad * 2) / Math.max(1, fields.length);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        background: palette.card,
        borderRadius: fs * 0.7,
        border: `${Math.max(1.5, fs * 0.045)}px solid ${palette.accent}88`,
        boxShadow: `0 ${fs * 0.3}px ${fs * 1.2}px ${palette.shadow}${palette.glow ? `, 0 0 ${fs * 0.8 * palette.glow}px ${palette.accent}44` : ""}`,
        opacity,
        fontFamily: BOARD_FONT,
        color: palette.cardInk,
        overflow: "visible",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: pad,
          top: pad,
          right: pad,
          display: "flex",
          alignItems: "center",
          gap: fs * 0.4,
        }}
      >
        {icon ? (
          <BoardGlyph name={icon} size={titleSize * 1.05} color={palette.accent} />
        ) : (
          <KindGlyph kind={kind} size={titleSize * 1.05} color={palette.accent} />
        )}
        <div
          style={{
            fontSize: titleSize,
            fontWeight: 900,
            lineHeight: FitText.LEADING,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {after.title}
        </div>
      </div>
      {tags.map((tag) => {
        const was = old.tags.get(tag);
        const will = now.tags.get(tag);
        const box = was && will ? mix(was, will) : (will ?? was);
        if (!box) return null;
        const scale = !was ? Ease.pop(t, 0.4, changed) : !will ? 1 - p : 1;
        const fresh = !was && will;
        const ticked = after.done.includes(tag);
        const tick = !ticked ? 0 : before.done.includes(tag) ? 1 : Ease.pop(t, 0.4, changed);
        return (
          <div
            key={tag}
            style={{
              position: "absolute",
              left: box.x,
              top: box.y,
              width: box.w,
              height: box.h,
              transform: `scale(${Math.max(0.01, scale)})`,
              transformOrigin: "left center",
              opacity: !will ? 1 - p : 1,
              display: "flex",
              alignItems: "center",
              gap: chip * 0.4,
              boxSizing: "border-box",
              padding: kind === "checklist" ? 0 : `0 ${chip * 0.7}px`,
              borderRadius: chip * 0.6,
              background: kind === "checklist" ? "transparent" : `${palette.accent2}22`,
              border:
                kind === "checklist"
                  ? "none"
                  : `${Math.max(1.5, chip * 0.05)}px solid ${fresh && p < 1 ? palette.warn : `${palette.accent2}99`}`,
              fontSize: chip,
              fontWeight: 700,
              whiteSpace: "nowrap",
              color: kind === "checklist" && !ticked ? palette.muted : palette.cardInk,
            }}
          >
            {kind === "checklist" ? (
              <KindGlyph
                kind="checklist"
                size={chip * 1.2}
                color={ticked ? palette.good : palette.muted}
                tick={Math.max(0, tick)}
              />
            ) : null}
            {tag}
          </div>
        );
      })}
      {fields.length ? (
        <div
          style={{
            position: "absolute",
            left: pad,
            right: pad,
            top: old.fieldsY + (now.fieldsY - old.fieldsY) * p,
            display: "flex",
          }}
        >
          {fields.map((field) => {
            const was = before.fields[field.id] ?? field.value;
            const will = after.fields[field.id] ?? field.value;
            const moved = was !== will && p < 1;
            const big = kind === "score" ? fs * 1.7 : fs * 1.05;
            return (
              <div key={field.id} style={{ width: cell, display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    fontSize: fs * 0.62,
                    fontWeight: 800,
                    letterSpacing: fs * 0.05,
                    textTransform: "uppercase",
                    color: palette.muted,
                  }}
                >
                  {field.label}
                </div>
                <div
                  style={{
                    fontSize: big,
                    fontWeight: 900,
                    color: moved ? palette.warn : palette.cardInk,
                    transform: `scale(${moved ? 1 + 0.12 * Math.sin(Math.PI * p) : 1})`,
                    transformOrigin: "left center",
                    whiteSpace: "nowrap",
                  }}
                >
                  {FieldValue.shown(was, will, p)}
                  {field.unit ? (
                    <span style={{ fontSize: big * 0.5, marginLeft: fs * 0.2 }}>{field.unit}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          right: -fs * 0.3,
          top: -fs * 0.7,
          display: "flex",
          gap: fs * 0.3,
        }}
      >
        {after.badges.map((badge, i) => {
          const pop = before.badges.includes(badge) ? 1 : Ease.pop(t, 0.35, changed);
          const tone = i % 2 ? palette.warn : palette.bad;
          return (
            <div
              key={badge}
              style={{
                fontSize: fs * 0.68,
                fontWeight: 900,
                letterSpacing: fs * 0.05,
                textTransform: "uppercase",
                color: tone,
                background: palette.card,
                border: `${Math.max(1.5, fs * 0.06)}px solid ${tone}`,
                borderRadius: fs * 0.25,
                padding: `${fs * 0.1}px ${fs * 0.35}px`,
                transform: `rotate(${-5 + i * 4}deg) scale(${Math.max(0.01, pop)})`,
                boxShadow: `0 ${fs * 0.1}px ${fs * 0.35}px ${palette.shadow}`,
                whiteSpace: "nowrap",
                opacity: fade,
              }}
            >
              {badge}
            </div>
          );
        })}
      </div>
    </div>
  );
}
