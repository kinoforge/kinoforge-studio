import { useMemo } from "react";
import { AbsoluteFill, type CalculateMetadataFunction, useCurrentFrame } from "remotion";
import type { CaptionWord } from "../captions.ts";
import { CodeScene } from "./code/scene.ts";
import { CodeView } from "./code/view.tsx";
import { DiagramScene } from "./diagram/scene.ts";
import { DiagramView } from "./diagram/view.tsx";
import { BoardElementsContext } from "./elements/glyph.tsx";
import type { BoardElements } from "./elements/spec.ts";
import { MapScene } from "./map/scene.ts";
import { MapLayer } from "./map/view.tsx";
import { MascotFigure } from "./mascot.tsx";
import { BoardLanguage } from "./pieces/data.tsx";
import { Ease } from "./pieces/ease.ts";
import { PieceView, StampBadge, StampView } from "./pieces/index.tsx";
import { RoadScene } from "./road/scene.ts";
import { RoadView } from "./road/view.tsx";
import type { Beat, Board, CaptionReserve, Mascot } from "./spec.ts";
import type { Stage } from "./stage.ts";
import { BOARD_FONT, type BoardColors, type BoardPalette, type BoardTheme, BoardThemes } from "./theme.ts";
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
  colors?: BoardColors | null;
  mascot?: Mascot | null;
  reserve?: CaptionReserve;
  /** The video's diagram nodes, code files, road side and map places, and the boards of the
   *  scenes before this one: the diagram, the code, the road and the map carry on from where
   *  they left them. */
  stage?: Stage | null;
  history?: Board[];
  /** The narration's language (ISO 639-1), for how numbers are written. */
  language?: string;
  elements?: BoardElements;
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
  static readonly HANDOVER = 0.6;

  static place(before: Box | undefined, after: Box | undefined, p: number, handover = false) {
    if (after && before) {
      return { box: CardMotion.lerp(before, after, p), opacity: 1, scale: 1 };
    }
    if (after) {
      const rise = Ease.pop(p, 1);
      const shown = handover
        ? Ease.clamp((p - CardMotion.HANDOVER) / (1 - CardMotion.HANDOVER))
        : Ease.clamp(p * 2);
      return {
        box: { ...after, y: after.y + (1 - Ease.clamp(rise)) * after.h * 0.35 },
        opacity: shown,
        scale: 0.86 + 0.14 * rise,
      };
    }
    const gone = before as Box;
    const left = handover ? Ease.clamp(p / CardMotion.HANDOVER) : p;
    return {
      box: { ...gone, y: gone.y - gone.h * 0.4 * p },
      opacity: 1 - left,
      scale: 1 - 0.08 * p,
    };
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
  const radius = Math.min(box.w, box.h) * 0.08;
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        background: palette.card,
        borderRadius: radius,
        boxShadow: `0 ${box.h * 0.03}px ${box.h * 0.09}px ${palette.shadow}`,
        opacity,
        transform: `rotate(${tilt}deg) scale(${scale})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: pad,
          boxSizing: "border-box",
          borderRadius: radius,
          overflow: "hidden",
        }}
      >
        <PieceView
          piece={beat.piece}
          w={box.w - pad * 2}
          h={box.h - pad * 2}
          t={t}
          span={span}
          palette={palette}
        />
      </div>
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
    </div>
  );
}

/** How far the board has left: after the last word, in the scene's closing moment, everything on
 *  it drifts up and fades so the next scene's first card rises into a clear board. */
class SceneExit {
  static readonly SECONDS = 0.45;
  static readonly RISE = 0.035;

  static of(t: number, seconds: number, words: readonly CaptionWord[]): number {
    const spoken = words.reduce((end, word) => Math.max(end, word.end), 0);
    const from = Math.max(spoken, seconds - SceneExit.SECONDS);
    return seconds - from > 0 ? Ease.inOut(t - from, seconds - from) : 0;
  }
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

  static look(t: number, target: Box, figure: Box, arrived: number): { x: number; y: number } {
    const idle = { x: 0.5 * Math.sin(t * 0.7), y: 0.25 * Math.sin(t * 0.53) };
    const dx = target.x + target.w / 2 - (figure.x + figure.w / 2);
    const dy = target.y + target.h / 2 - (figure.y + figure.h * 0.4);
    const length = Math.hypot(dx, dy) || 1;
    const focus = arrived < 0 ? 0 : Ease.clamp(1 - (t - arrived) / 2.5);
    return {
      x: idle.x + (dx / length - idle.x) * focus,
      y: idle.y + (dy / length - idle.y) * focus,
    };
  }

  static cheer(beats: readonly Beat[], starts: readonly number[], t: number): number {
    return Math.max(
      0,
      ...beats.map((beat, i) =>
        beat.piece.type === "stamp" && t >= starts[i] && t < starts[i] + 0.9
          ? Math.sin((Math.PI * (t - starts[i])) / 0.9)
          : 0,
      ),
    );
  }

  static wave(first: boolean, t: number): number {
    return first && t >= 0.3 && t < 2.3 ? Math.sin((Math.PI * (t - 0.3)) / 2) : 0;
  }

  static gesture(words: readonly CaptionWord[], t: number): number {
    const speaking = Math.max(
      0,
      ...words.map(
        (word) => Ease.clamp((t - word.start + 0.25) / 0.25) * Ease.clamp(1 - (t - word.end) / 0.4),
      ),
    );
    return speaking * (0.5 + 0.5 * Math.sin(t * 2.6));
  }
}

/** One scene of an explainer: pieces arrive on the narration's cues and stack on a board that
 *  reflows as they come and go, beside a mascot that talks with the voice. The board is data
 *  (spec.ts); nothing here takes a position from the writer. */
export function ExplainerScene(props: ExplainerProps) {
  const frame = useCurrentFrame();
  return <BoardMoment {...props} t={frame / props.fps} />;
}

export function BoardMoment({
  language = "en",
  elements,
  ...props
}: ExplainerProps & { t: number }) {
  return (
    <BoardLanguage.Provider value={language}>
      <BoardElementsContext.Provider value={elements ?? {}}>
        <BoardScene {...props} />
      </BoardElementsContext.Provider>
    </BoardLanguage.Provider>
  );
}

function BoardScene({
  width,
  height,
  seconds,
  board,
  words,
  theme,
  colors,
  mascot,
  reserve = "bottom",
  stage,
  history = [],
  t,
}: ExplainerProps & { t: number }) {
  const palette = BoardThemes.of(theme, colors);
  const beats = board.beats;
  const starts = useMemo(() => BoardCues.resolve(beats, words, seconds), [beats, words, seconds]);
  const layout = BoardLayout.of(width, height, reserve, !!mascot);
  const diagram = DiagramScene.of(board, starts, seconds, history, layout.content);
  const stageNodes = useMemo(() => DiagramScene.stage(stage), [stage]);
  const files = useMemo(() => CodeScene.files(stage), [stage]);
  const code = diagram
    ? null
    : CodeScene.of(board, starts, seconds, history, layout.content, files);
  const road =
    diagram || code ? null : RoadScene.of(board, starts, seconds, history, layout.content, stage);
  const map =
    diagram || code || road
      ? null
      : MapScene.of(board, starts, seconds, history, layout.content, stage);
  // A scene on a surface (diagram, code, road, map) shows one card at a time, in a band beside it.
  const band = diagram?.band ?? code?.band ?? road?.band ?? map?.band;
  const capacity = band ? 0 : layout.capacity;
  const place = (ids: number[]) =>
    band ? new Map(ids.map((id) => [id, band])) : BoardStack.boxes(beats, ids, layout.content);

  let current = -1;
  while (current + 1 < beats.length && starts[current + 1] <= t) current++;
  const now = current >= 0 ? BoardStack.visible(beats, current, capacity) : [];
  const before = current > 0 ? BoardStack.visible(beats, current - 1, capacity) : [];
  const nowBoxes = place(now);
  const beforeBoxes = place(before);
  const p = current >= 0 ? Ease.out(t - starts[current], 0.5) : 0;
  const ids = [...new Set([...before, ...now])].filter((id) => now.includes(id) || p < 1);

  let stamp = -1;
  for (let i = 0; i <= current; i++) {
    if (beats[i].clear) stamp = -1;
    if (beats[i].piece.type === "stamp") stamp = i;
  }
  const stampPiece = stamp >= 0 && StampBadge.shows(t - starts[stamp]) ? beats[stamp].piece : null;
  const stampCard = stamp >= 0 ? BoardStack.visible(beats, stamp, capacity).at(-1) : undefined;
  const handover = ids.some((id) => !now.includes(id));
  const cardBox = (id: number) =>
    CardMotion.place(
      id === current ? undefined : beforeBoxes.get(id),
      nowBoxes.get(id),
      p,
      handover,
    );
  const stampAnchor =
    stampCard != null && ids.includes(stampCard)
      ? cardBox(stampCard).box
      : band && band.h > 0
        ? band
        : layout.content;
  const stampSize =
    stampPiece?.type === "stamp"
      ? StampBadge.size(stampPiece.text, Math.min(width, height), stampAnchor.w)
      : 0;
  const leave = SceneExit.of(t, seconds, words);

  return (
    <AbsoluteFill
      style={{ backgroundColor: palette.background, fontFamily: BOARD_FONT, overflow: "hidden" }}
    >
      <Backdrop palette={palette} width={width} />
      <AbsoluteFill
        style={{
          opacity: 1 - leave,
          transform: `translateY(${-leave * height * SceneExit.RISE}px)`,
        }}
      >
        {diagram ? (
          <DiagramView
            script={diagram.script}
            boxes={diagram.boxes}
            from={diagram.from}
            wide={diagram.wide}
            fromWide={diagram.fromWide}
            area={diagram.area}
            stage={stageNodes}
            t={t}
            palette={palette}
          />
        ) : null}
        {code ? <CodeView plan={code} t={t} palette={palette} /> : null}
        {road ? <RoadView plan={road} t={t} palette={palette} /> : null}
        {map ? <MapLayer plan={map} t={t} palette={palette} /> : null}
        {ids.map((id) => {
          const place = cardBox(id);
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
              left: Math.min(
                stampAnchor.x + stampAnchor.w + stampSize * 0.4,
                width - stampSize * 0.6,
              ),
              top: Math.max(stampSize * 0.6, stampAnchor.y),
              transform: "translate(-100%, -50%)",
              pointerEvents: "none",
            }}
          >
            <StampView
              piece={stampPiece}
              size={stampSize}
              t={t - starts[stamp]}
              palette={palette}
            />
          </div>
        ) : null}
      </AbsoluteFill>
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
              look: ScenePose.look(
                t,
                current >= 0 && ids.includes(current)
                  ? cardBox(current).box
                  : (band ?? layout.content),
                layout.mascot,
                current >= 0 ? starts[current] : -1,
              ),
              cheer: ScenePose.cheer(beats, starts, t),
              wave: ScenePose.wave(history.length === 0, t),
              gesture: ScenePose.gesture(words, t),
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
