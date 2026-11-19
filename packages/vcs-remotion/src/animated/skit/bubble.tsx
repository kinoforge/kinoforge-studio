import type { CaptionWord } from "../../captions.ts";
import { Ease } from "../shared/ease.ts";
import { BOARD_FONT, type BoardPalette, BoardThemes } from "../shared/theme.ts";
import { FitText } from "../shared/fit-text.ts";

export interface BubbleSpot {
  x: number;
  y: number;
}

export interface BubbleRoom {
  left: number;
  right: number;
  top: number;
  width: number;
}

export class BubbleShape {
  static readonly LINES = 4;
  static readonly LEAST = 0.03;
  static readonly PAD = 0.55;
  static readonly GAP = 0.9;
  static readonly TAIL = 1.1;
  static readonly POP = 0.3;
  static readonly LEAVE = 0.28;
  static readonly PHRASE = 90;

  static size(text: string, room: BubbleRoom, spot: BubbleSpot, frame: number) {
    const max = frame * 0.044;
    const pad = max * BubbleShape.PAD * 1.6;
    const tail = max * BubbleShape.TAIL;
    const tall = Math.max(max * 2, spot.y - room.top - tail - max * BubbleShape.GAP);
    const inner = { w: room.width - pad * 2, h: tall - pad * 2 - max * 0.9 };
    const font = Math.max(
      frame * BubbleShape.LEAST,
      FitText.size(text, inner, max, BubbleShape.LINES),
    );
    const border = BubbleShape.border(font);
    const widest = Math.max(
      ...text.split(/\s+/).map((word) => FitText.width(word, font)),
      FitText.width(text, font) / FitText.lines(text, inner.w, font),
    );
    const w = Math.min(room.width, Math.max(widest * 1.08 + (pad + border) * 2, room.width * 0.45));
    const lines = FitText.lines(text, w - (pad + border) * 2, font);
    const h = lines * font * FitText.LEADING + (pad + border) * 2;
    const x = Math.min(room.right - w, Math.max(room.left, spot.x - w / 2));
    const y = spot.y - tail - h - max * BubbleShape.GAP * 0.3;
    return { x, y, w, h, font, pad, tail };
  }

  static border(font: number): number {
    return Math.max(2, font * 0.06);
  }

  static need(text: string, width: number, frame: number): number {
    const max = frame * 0.044;
    const room = { left: 0, right: width, top: 0, width };
    const shape = BubbleShape.size(
      BubbleShape.longest(text),
      room,
      { x: width / 2, y: frame * 10 },
      frame,
    );
    return shape.h + shape.tail + max * (0.9 + BubbleShape.GAP);
  }

  static phrases(text: string): string[][] {
    const tokens = text.split(/\s+/).filter(Boolean);
    if (text.length <= BubbleShape.PHRASE) return [tokens];
    const out: string[][] = [];
    let current: string[] = [];
    let size = 0;
    for (const token of tokens) {
      if (current.length && size + token.length + 1 > BubbleShape.PHRASE) {
        out.push(current);
        current = [];
        size = 0;
      }
      size += token.length + (current.length ? 1 : 0);
      current.push(token);
      const stop = /[.!?;:]["')]*$/.test(token) ? 0.45 : /,["')]*$/.test(token) ? 0.7 : 2;
      if (size > BubbleShape.PHRASE * stop) {
        out.push(current);
        current = [];
        size = 0;
      }
    }
    if (current.length) out.push(current);
    return out;
  }

  static longest(text: string): string {
    return BubbleShape.phrases(text)
      .map((phrase) => phrase.join(" "))
      .reduce((a, b) => (b.length > a.length ? b : a), "");
  }

  static reached(words: readonly CaptionWord[], count: number, t: number): number {
    if (!words.length || !count) return 0;
    const said = words.filter((word) => t >= word.start).length;
    return Math.max(0, Math.min(count - 1, Math.floor(((said - 1) * count) / words.length)));
  }

  static spoken(words: readonly CaptionWord[], count: number, t: number): number {
    if (!words.length || !count) return -1;
    const at = words.findIndex((word) => t >= word.start && t < word.end + 0.08);
    if (at < 0) return -1;
    return Math.min(count - 1, Math.floor((at * count) / words.length));
  }
}

export function SpeechBubble({
  text,
  role,
  color,
  words,
  t,
  from,
  leave,
  spot,
  room,
  frame,
  palette,
}: {
  text: string;
  role: string;
  color: string;
  words: readonly CaptionWord[];
  t: number;
  from: number;
  leave: number;
  spot: BubbleSpot;
  room: BubbleRoom;
  frame: number;
  palette: BoardPalette;
}) {
  if (t < from || !text.trim()) return null;
  const shape = BubbleShape.size(BubbleShape.longest(text), room, spot, frame);
  const pop = Ease.pop(t, BubbleShape.POP, from);
  const gone = leave >= 0 ? Ease.out(t, BubbleShape.LEAVE, leave) : 0;
  const scale = Math.max(0.01, pop * (1 - gone * 0.15));
  const phrases = BubbleShape.phrases(text);
  const count = phrases.reduce((sum, phrase) => sum + phrase.length, 0);
  const reached = leave >= 0 ? count - 1 : BubbleShape.reached(words, count, t);
  let start = 0;
  let at = 0;
  while (at < phrases.length - 1 && reached >= start + phrases[at].length) {
    start += phrases[at].length;
    at += 1;
  }
  const tokens = phrases[at];
  const current = leave >= 0 ? -1 : BubbleShape.spoken(words, count, t) - start;
  const glow = shape.font * 0.25 * palette.glow;
  const tailX = Math.min(shape.x + shape.w - shape.font, Math.max(shape.x + shape.font, spot.x));
  const chip = shape.font * 0.62;
  const originX = tailX - shape.x;
  const activeColor = BoardThemes.visibleOn(color, palette.card);
  const chipInk = BoardThemes.readable(color);
  return (
    <div
      style={{
        position: "absolute",
        left: shape.x,
        top: shape.y,
        width: shape.w,
        height: shape.h,
        opacity: 1 - gone,
        transform: `scale(${scale})`,
        transformOrigin: `${originX}px ${shape.h + shape.tail}px`,
      }}
    >
      <svg
        width={shape.w}
        height={shape.h + shape.tail}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        <path
          d={`M ${originX - shape.tail * 0.55} ${shape.h - 2} L ${originX + (spot.x - tailX) * 0.3} ${shape.h + shape.tail} L ${originX + shape.tail * 0.55} ${shape.h - 2} Z`}
          fill={palette.card}
          stroke={color}
          strokeWidth={BubbleShape.border(shape.font)}
          strokeLinejoin="round"
          style={{ filter: glow ? `drop-shadow(0 0 ${glow}px ${color})` : undefined }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: palette.card,
          border: `${BubbleShape.border(shape.font)}px solid ${color}`,
          borderRadius: Math.min(shape.h / 2, shape.font * 1.6),
          boxShadow: glow ? `0 0 ${glow}px ${color}, 0 0 ${glow * 2.2}px ${color}55` : "none",
          boxSizing: "border-box",
          padding: shape.pad,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: BOARD_FONT,
            fontSize: shape.font,
            lineHeight: FitText.LEADING,
            fontWeight: 700,
            color: palette.cardInk,
            textAlign: "center",
            overflowWrap: "normal",
          }}
        >
          {tokens.map((token, i) => (
            <span key={`${i}-${token}`} style={{ color: i === current ? activeColor : undefined }}>
              {i ? " " : ""}
              {token}
            </span>
          ))}
        </div>
      </div>
      {role ? (
        <div
          style={{
            position: "absolute",
            left: shape.font * 0.9,
            top: -chip * 0.95,
            fontFamily: BOARD_FONT,
            fontSize: chip,
            fontWeight: 900,
            letterSpacing: chip * 0.08,
            textTransform: "uppercase",
            color: chipInk,
            background: color,
            borderRadius: chip * 0.5,
            padding: `${chip * 0.18}px ${chip * 0.55}px`,
            whiteSpace: "nowrap",
            boxShadow: glow ? `0 0 ${glow}px ${color}` : "none",
          }}
        >
          {role}
        </div>
      ) : null}
    </div>
  );
}
