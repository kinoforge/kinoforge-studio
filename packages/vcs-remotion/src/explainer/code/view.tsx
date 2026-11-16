import { useMemo } from "react";
import { MARK_COLORS } from "../diagram/spec.ts";
import { Ease } from "../pieces/ease.ts";
import { BOARD_FONT, BOARD_MONO, type BoardPalette } from "../theme.ts";
import { type Box, FitText } from "../timeline.ts";
import { CodeLayout, type CodePlan } from "./scene.ts";
import type { Lit, Sheet } from "./state.ts";
import { Syntax, type Token, type TokenKind } from "./syntax.ts";

const EDITOR = {
  background: "#15171E",
  bar: "#1F222B",
  border: "#2A2E38",
  number: "#4B5263",
  numberLit: "#C8CCD4",
  muted: "#8A90A0",
  ink: "#D7DAE0",
};

const INK: Record<TokenKind, string> = {
  plain: EDITOR.ink,
  keyword: "#C678DD",
  string: "#98C379",
  number: "#D19A66",
  comment: "#7F848E",
  call: "#61AFEF",
  type: "#E5C07B",
  punct: "#ABB2BF",
  added: "#98C379",
  removed: "#E06C75",
};

/** What is written of a sheet at a time: characters per line, -1 for a line not reached. */
class Written {
  static chars(sheet: Sheet, t: number): number[] {
    const out = sheet.file.lines.map((line, i) => (i < sheet.base ? line.length : -1));
    for (const typing of sheet.typing) {
      if (t < typing.at) continue;
      let budget = (t - typing.at) * typing.rate;
      for (let i = typing.from; i < typing.to && budget >= 0; i++) {
        const line = sheet.file.lines[i];
        out[i] = Math.min(line.length, Math.floor(budget));
        budget -= line.length + 4;
      }
    }
    return out;
  }

  static typing(sheet: Sheet, t: number): boolean {
    return sheet.typing.some((typing) => {
      const chars = sheet.file.lines
        .slice(typing.from, typing.to)
        .reduce((sum, line) => sum + line.length + 4, 0);
      return t >= typing.at && t < typing.at + chars / typing.rate;
    });
  }

  static slice(tokens: readonly Token[], count: number): Token[] {
    const out: Token[] = [];
    let left = count;
    for (const token of tokens) {
      if (left <= 0) break;
      out.push({ kind: token.kind, text: token.text.slice(0, left) });
      left -= token.text.length;
    }
    return out;
  }
}

class CodeScroll {
  static readonly LEAD = 0.6;
  static readonly SAMPLES = 6;
  static readonly SPAN = 0.3;

  static top(sheet: Sheet, t: number, rows: number): number {
    const most = sheet.file.lines.length - rows;
    if (most <= 0) return 0;
    let sum = 0;
    for (let k = 0; k < CodeScroll.SAMPLES; k++) {
      const at = Math.max(sheet.at ?? 0, t - (k * CodeScroll.SPAN) / (CodeScroll.SAMPLES - 1));
      sum += Math.min(most, Math.max(0, CodeScroll.follow(sheet, at) - rows * CodeScroll.LEAD));
    }
    return sum / CodeScroll.SAMPLES;
  }

  private static follow(sheet: Sheet, t: number): number {
    const lit = sheet.lit.find((entry) => t >= entry.at && t < entry.until);
    if (lit) return (lit.lines[0] + (lit.lines.at(-1) as number)) / 2 + 0.5;
    const chars = Written.chars(sheet, t);
    const last = chars.reduce((at, count, i) => (count >= 0 ? i : at), -1);
    if (last < 0) return 0;
    const line = sheet.file.lines[last];
    return last + (line.length ? Math.min(1, chars[last] / line.length) : 1);
  }
}

/** The line a lit block's badge sits on: its first line, or a free line beside the block,
 *  whichever leaves room for it after the code written there, so it never covers code. */
class BadgeRow {
  static of(lit: Lit, chars: readonly number[], size: number, gutter: number, width: number) {
    const first = lit.lines[0];
    const last = lit.lines.at(-1) as number;
    const label = FitText.width(lit.label ?? "", 0.72) + 1;
    const free = (row: number) => row >= 0 && row < chars.length && !lit.lines.includes(row);
    const rows = [first, first - 1, last + 1].filter((row) => row === first || free(row));
    const fits = (row: number) =>
      gutter + size * ((Math.max(0, chars[row]) + 1) * FitText.MONO + label + 0.8) <= width;
    return rows.find(fits) ?? rows[1] ?? first;
  }
}

class SheetMotion {
  static place(plan: CodePlan, sheet: Sheet, index: number, t: number) {
    const layout = CodeLayout.of(sheet.file, plan.area);
    if (sheet.at == null) {
      if (!plan.from) return { layout, box: layout.box, opacity: Ease.out(t, 0.45), scale: 1 };
      const from = CodeLayout.of(sheet.file, plan.from);
      const p = Ease.out(t, 0.8);
      const mix = (a: number, b: number) => a + (b - a) * p;
      const box: Box = {
        x: mix(from.box.x, layout.box.x),
        y: mix(from.box.y, layout.box.y),
        w: mix(from.box.w, layout.box.w),
        h: mix(from.box.h, layout.box.h),
      };
      const glided = {
        box,
        size: mix(from.size, layout.size),
        bar: mix(from.bar, layout.bar),
        gutter: mix(from.gutter, layout.gutter),
        pad: mix(from.pad, layout.pad),
      };
      return { layout: glided, box, opacity: 1, scale: 1 };
    }
    if (index > 0)
      return { layout, box: layout.box, opacity: Ease.out(t - sheet.at, 0.3), scale: 1 };
    const pop = Ease.pop(t - sheet.at, 0.5);
    return {
      layout,
      box: layout.box,
      opacity: Ease.clamp((t - sheet.at) * 3),
      scale: 0.92 + 0.08 * pop,
    };
  }
}

function TitleBar({ name, lang, bar }: { name: string; lang: string; bar: number }) {
  return (
    <div
      style={{
        height: bar,
        background: EDITOR.bar,
        display: "flex",
        alignItems: "flex-end",
        paddingLeft: bar * 0.4,
        gap: bar * 0.2,
      }}
    >
      <div style={{ display: "flex", gap: bar * 0.18, alignSelf: "center" }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((color) => (
          <div
            key={color}
            style={{
              width: bar * 0.26,
              height: bar * 0.26,
              borderRadius: "50%",
              background: color,
            }}
          />
        ))}
      </div>
      <div
        style={{
          marginLeft: bar * 0.3,
          height: bar * 0.72,
          padding: `0 ${bar * 0.45}px`,
          display: "flex",
          alignItems: "center",
          background: EDITOR.background,
          borderRadius: `${bar * 0.16}px ${bar * 0.16}px 0 0`,
          fontFamily: BOARD_MONO,
          fontSize: bar * 0.32,
          color: EDITOR.ink,
        }}
      >
        {name}
      </div>
      <div
        style={{
          marginLeft: "auto",
          marginRight: bar * 0.45,
          alignSelf: "center",
          fontFamily: BOARD_MONO,
          fontSize: bar * 0.26,
          color: EDITOR.muted,
        }}
      >
        {lang}
      </div>
    </div>
  );
}

function LitBadge({ lit, size, t, color }: { lit: Lit; size: number; t: number; color: string }) {
  const pop = Ease.pop(t - lit.at - 0.15, 0.4);
  return (
    <div
      style={{
        position: "absolute",
        right: size * 0.8,
        top: "50%",
        transform: `translateY(-50%) scale(${Math.max(0, pop)})`,
        transformOrigin: "right center",
        padding: `${size * 0.12}px ${size * 0.5}px`,
        borderRadius: size * 0.4,
        background: color,
        color: "#0E1016",
        fontFamily: BOARD_FONT,
        fontWeight: 800,
        fontSize: size * 0.72,
        whiteSpace: "nowrap",
      }}
    >
      {lit.label}
    </div>
  );
}

function SheetView({
  plan,
  sheet,
  index,
  t,
  palette,
}: {
  plan: CodePlan;
  sheet: Sheet;
  index: number;
  t: number;
  palette: BoardPalette;
}) {
  const tokens = useMemo(() => Syntax.lines(sheet.file.lines, sheet.file.lang), [sheet.file]);
  const { layout, box, opacity, scale } = SheetMotion.place(plan, sheet, index, t);
  const { size, bar, gutter, pad } = layout;
  const rows = CodeLayout.of(sheet.file, plan.area).rows;
  const chars = Written.chars(sheet, t);
  const last = chars.reduce((at, count, i) => (count >= 0 ? i : at), -1);
  const typing = Written.typing(sheet, t);
  const lit = sheet.lit.find((entry) => t >= entry.at && t < entry.until);
  const shine = lit ? Ease.out(t - lit.at, 0.35) : 0;
  const tone = lit ? palette[MARK_COLORS[lit.tone]] : EDITOR.ink;
  const row = size * CodeLayout.LINE;
  const top = CodeScroll.top(sheet, t, rows);
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        borderRadius: size * 0.6,
        overflow: "hidden",
        background: EDITOR.background,
        boxShadow: `0 ${size * 0.6}px ${size * 1.8}px ${palette.shadow}, inset 0 0 0 2px ${EDITOR.border}`,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <TitleBar name={sheet.file.name} lang={sheet.file.lang} bar={bar} />
      <div
        style={{
          position: "absolute",
          top: bar + pad * 0.8,
          left: 0,
          right: 0,
          height: rows * row,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: -top * row, left: 0, right: 0 }}>
          {sheet.file.lines.map((_, i) => {
            const shown = chars[i];
            const on = !!lit && lit.lines.includes(i);
            const change = tokens[i]?.[0]?.kind;
            const tint =
              change === "added" || change === "removed" ? `${INK[change]}1F` : undefined;
            return (
              <div
                key={i}
                style={{
                  position: "relative",
                  height: row,
                  display: "flex",
                  alignItems: "center",
                  fontFamily: BOARD_MONO,
                  fontSize: size,
                  whiteSpace: "pre",
                  background: tint,
                  opacity: lit && !on ? 1 - 0.62 * shine : 1,
                }}
              >
                {on ? (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: `${tone}2E`,
                        transformOrigin: "left center",
                        transform: `scaleX(${shine})`,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: Math.max(3, size * 0.16),
                        background: tone,
                        opacity: shine,
                      }}
                    />
                  </>
                ) : null}
                <div
                  style={{
                    position: "relative",
                    width: gutter,
                    flexShrink: 0,
                    boxSizing: "border-box",
                    paddingRight: size * 0.9,
                    textAlign: "right",
                    color: on ? EDITOR.numberLit : EDITOR.number,
                  }}
                >
                  {shown >= 0 ? i + 1 : ""}
                </div>
                <div style={{ position: "relative" }}>
                  {shown > 0
                    ? Written.slice(tokens[i], shown).map((token, k) => (
                        <span
                          key={k}
                          style={{
                            color: INK[token.kind],
                            fontStyle: token.kind === "comment" ? "italic" : undefined,
                          }}
                        >
                          {token.text}
                        </span>
                      ))
                    : null}
                  {i === last ? (
                    <span
                      style={{
                        color: palette.accent,
                        opacity: typing || Math.floor(t * 2.2) % 2 === 0 ? 1 : 0,
                      }}
                    >
                      ▍
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
          {lit?.label ? (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: BadgeRow.of(lit, chars, size, gutter, box.w) * row,
                height: row,
              }}
            >
              <LitBadge lit={lit} size={size} t={t} color={tone} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The code editor a scene writes in: the open file typing in line by line, with the lines
 *  the narration points at lit and the rest dimmed. */
export function CodeView({
  plan,
  t,
  palette,
}: {
  plan: CodePlan;
  t: number;
  palette: BoardPalette;
}) {
  const sheets = plan.script.sheets;
  let index = 0;
  for (let i = 0; i < sheets.length; i++) if ((sheets[i].at ?? 0) <= t) index = i;
  const sheet = sheets[index];
  if (sheet.at != null && t < sheet.at) return null;
  return <SheetView key={index} plan={plan} sheet={sheet} index={index} t={t} palette={palette} />;
}
