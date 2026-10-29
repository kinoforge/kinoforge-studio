import { useMemo } from "react";
import { AbsoluteFill, type CalculateMetadataFunction, useCurrentFrame } from "remotion";
import type { CaptionWord } from "../captions.ts";
import { MascotFigure } from "./mascot.tsx";
import { Ease } from "./pieces/ease.ts";
import { PieceView, StampView } from "./pieces/index.tsx";
import type { Beat, Board, CaptionReserve, Mascot } from "./spec.ts";
import { BOARD_FONT, type BoardPalette, type BoardTheme, BoardThemes } from "./theme.ts";
import { BoardCues, BoardLayout, BoardStack, type Box } from "./timeline.ts";

export const EXPLAINER_COMPOSITION_ID = "ExplainerScene";

export type ExplainerProps = {
  fps: number;
  width: number;
  height: number;
  seconds: number;
  board: Board;
  words: CaptionWord[];
  theme?: BoardTheme;
  mascot?: Mascot | null;
  reserve?: CaptionReserve;
};

export const DEFAULT_EXPLAINER_PROPS: ExplainerProps = {
  fps: 30,
  width: 1080,
  height: 1920,
  seconds: 4,
  board: { mood: "happy", beats: [{ cue: "hello", piece: { type: "title", text: "Hello" } }] },
  words: [],
  theme: "paper",
  mascot: { rig: "pip", hat: "none" },
  reserve: "bottom",
};

function Backdrop({ palette, width }: { palette: BoardPalette; width: number }) {
  const unit = Math.round(width / 18);
  switch (palette.pattern) {
    case "grid":
      return (
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${palette.ink}14 1px, transparent 1px), linear-gradient(90deg, ${palette.ink}14 1px, transparent 1px), linear-gradient(${palette.ink}26 2px, transparent 2px), linear-gradient(90deg, ${palette.ink}26 2px, transparent 2px)`,
            backgroundSize: `${unit}px ${unit}px, ${unit}px ${unit}px, ${unit * 5}px ${unit * 5}px, ${unit * 5}px ${unit * 5}px`,
          }}
        />
      );
    case "dots":
      return (
        <AbsoluteFill
          style={{
            backgroundImage: `radial-gradient(${palette.muted}38 2px, transparent 2.5px)`,
            backgroundSize: `${unit}px ${unit}px`,
          }}
        />
      );
    default:
      return (
        <AbsoluteFill
          style={{
            opacity: palette.pattern === "dust" ? 0.08 : 0.1,
            mixBlendMode: palette.pattern === "dust" ? "screen" : "multiply",
          }}
        >
          <svg width="100%" height="100%">
            <filter id="board-fibers">
              <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves={3} seed={7} />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#board-fibers)" />
          </svg>
        </AbsoluteFill>
      );
  }
}

/** Where a card stands mid-move: entering from below, settling, or leaving upward. */
class CardMotion {
  static place(before: Box | undefined, after: Box | undefined, p: number) {
    if (after && before) {
      return { box: CardMotion.lerp(before, after, p), opacity: 1, scale: 1 };
    }
    if (after) {
      const rise = Ease.pop(p, 1);
      return {
        box: { ...after, y: after.y + (1 - Ease.clamp(rise)) * after.h * 0.35 },
        opacity: Ease.clamp(p * 2),
        scale: 0.86 + 0.14 * rise,
      };
    }
    const gone = before as Box;
    return { box: { ...gone, y: gone.y - gone.h * 0.4 * p }, opacity: 1 - p, scale: 1 - 0.08 * p };
  }

  private static lerp(a: Box, b: Box, p: number): Box {
    const mix = (x: number, y: number) => x + (y - x) * p;
    return { x: mix(a.x, b.x), y: mix(a.y, b.y), w: mix(a.w, b.w), h: mix(a.h, b.h) };
  }
}

function Card({
  beat,
  id,
  box,
  opacity,
  scale,
  t,
  span,
  palette,
}: {
  beat: Beat;
  id: number;
  box: Box;
  opacity: number;
  scale: number;
  t: number;
  span: number;
  palette: BoardPalette;
}) {
  const pad = Math.min(box.w, box.h) * 0.09;
  const tilt = (((id * 37) % 5) - 2) * 0.45;
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        padding: pad,
        boxSizing: "border-box",
        background: palette.card,
        borderRadius: Math.min(box.w, box.h) * 0.08,
        boxShadow: `0 ${box.h * 0.03}px ${box.h * 0.09}px ${palette.shadow}`,
        opacity,
        transform: `rotate(${tilt}deg) scale(${scale})`,
      }}
    >
      {palette.tape ? (
        <div
          style={{
            position: "absolute",
            top: -box.h * 0.05,
            left: box.w / 2 - box.w * 0.08,
            width: box.w * 0.16,
            height: box.h * 0.1,
            maxHeight: 44,
            background: "rgba(255, 244, 200, 0.7)",
            transform: `rotate(${-tilt * 3}deg)`,
          }}
        />
      ) : null}
      <PieceView
        piece={beat.piece}
        w={box.w - pad * 2}
        h={box.h - pad * 2}
        t={t}
        span={span}
        palette={palette}
      />
    </div>
  );
}

class ScenePose {
  static open(words: readonly CaptionWord[], t: number): number {
    const word = words.find((entry) => t >= entry.start && t < entry.end);
    return word ? 0.3 + 0.7 * Math.abs(Math.sin((t - word.start) * 14)) : 0;
  }

  static point(starts: readonly number[], t: number): number {
    return Math.max(
      0,
      ...starts.map((at) => (t >= at && t < at + 1.1 ? Math.sin((Math.PI * (t - at)) / 1.1) : 0)),
    );
  }

  static blink(t: number): boolean {
    return t % 3.4 < 0.12;
  }
}

/** One scene of an explainer: pieces arrive on the narration's cues and stack on a board that
 *  reflows as they come and go, beside a mascot that talks with the voice. The board is data
 *  (spec.ts); nothing here takes a position from the writer. */
export function ExplainerScene({
  fps,
  width,
  height,
  seconds,
  board,
  words,
  theme,
  mascot,
  reserve = "bottom",
}: ExplainerProps) {
  const frame = useCurrentFrame();
  const t = frame / fps;
  const palette = BoardThemes.of(theme);
  const beats = board.beats;
  const starts = useMemo(() => BoardCues.resolve(beats, words, seconds), [beats, words, seconds]);
  const layout = BoardLayout.of(width, height, reserve, !!mascot);

  let current = -1;
  while (current + 1 < beats.length && starts[current + 1] <= t) current++;
  const now = current >= 0 ? BoardStack.visible(beats, current, layout.capacity) : [];
  const before = current > 0 ? BoardStack.visible(beats, current - 1, layout.capacity) : [];
  const nowBoxes = BoardStack.boxes(beats, now, layout.content);
  const beforeBoxes = BoardStack.boxes(beats, before, layout.content);
  const p = current >= 0 ? Ease.out(t - starts[current], 0.5) : 0;
  const ids = [...new Set([...before, ...now])].filter((id) => now.includes(id) || p < 1);

  let stamp = -1;
  for (let i = 0; i <= current; i++) {
    if (beats[i].clear) stamp = -1;
    if (beats[i].piece.type === "stamp") stamp = i;
  }
  const stampPiece = stamp >= 0 ? beats[stamp].piece : null;

  return (
    <AbsoluteFill
      style={{ backgroundColor: palette.background, fontFamily: BOARD_FONT, overflow: "hidden" }}
    >
      <Backdrop palette={palette} width={width} />
      {ids.map((id) => {
        const place = CardMotion.place(
          id === current ? undefined : beforeBoxes.get(id),
          nowBoxes.get(id),
          p,
        );
        return (
          <Card
            key={id}
            beat={beats[id]}
            id={id}
            box={place.box}
            opacity={place.opacity}
            scale={place.scale}
            t={t - starts[id]}
            span={(starts[id + 1] ?? seconds) - starts[id]}
            palette={palette}
          />
        );
      })}
      {stampPiece?.type === "stamp" ? (
        <div
          style={{
            position: "absolute",
            left: layout.content.x,
            top: layout.content.y,
            width: layout.content.w,
            height: layout.content.h,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <StampView
            piece={stampPiece}
            w={layout.content.w}
            t={t - starts[stamp]}
            palette={palette}
          />
        </div>
      ) : null}
      {mascot && layout.mascot ? (
        <div
          style={{
            position: "absolute",
            left: layout.mascot.x,
            top: layout.mascot.y,
            width: layout.mascot.w,
            height: layout.mascot.h,
          }}
        >
          <MascotFigure
            rig={mascot.rig}
            hat={mascot.hat}
            palette={palette}
            pose={{
              mood: board.mood,
              open: ScenePose.open(words, t),
              blink: ScenePose.blink(t),
              point: ScenePose.point(starts, t),
              t,
            }}
          />
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

export const explainerCalcMeta: CalculateMetadataFunction<ExplainerProps> = ({ props }) => ({
  durationInFrames: Math.max(1, Math.round(props.seconds * props.fps)),
  fps: props.fps,
  width: props.width,
  height: props.height,
});
