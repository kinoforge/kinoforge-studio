import { useMemo } from "react";
import { AbsoluteFill, type CalculateMetadataFunction, useCurrentFrame } from "remotion";
import type { CaptionWord } from "../captions.ts";
import { BoardMoment } from "../explainer/composition.tsx";
import { BoardElementsContext } from "../explainer/elements/glyph.tsx";
import type { BoardElements } from "../explainer/elements/spec.ts";
import { Ease } from "../explainer/pieces/ease.ts";
import type { Board, CaptionReserve } from "../explainer/spec.ts";
import type { Stage } from "../explainer/stage.ts";
import {
  BOARD_FONT,
  type BoardColors,
  type BoardGlow,
  type BoardPalette,
  type BoardTheme,
  BoardThemes,
  PAINTS,
} from "../explainer/theme.ts";
import { BoardCues } from "../explainer/timeline.ts";
import { SetBackdrop } from "./backdrop.tsx";
import { BubbleShape, SpeechBubble } from "./bubble.tsx";
import { CardLayout, RunningCard } from "./card.tsx";
import { SetPiece } from "./props.tsx";
import { ReactionMark, ReactionTiming } from "./reactions.tsx";
import { Chair, DeskSet, type FigureFrame, POSE_SPECS, PoseMix, Rig, StickFigure } from "./rig.tsx";
import { type CastMember, type Draw, type Move, OFF, type SkitLine, type SkitSet } from "./spec.ts";
import { CardMemory, type CardState, type MemberState, SkitMemory, SkitPlaces } from "./state.ts";

export const SKIT_COMPOSITION_ID = "SkitScene";

export interface SkitMoment {
  line: SkitLine;
  text: string;
}

export interface SkitBoard {
  board: Board;
  stage?: Stage | null;
  history?: Board[];
}

export interface SkitNext {
  draw?: Draw;
}

export type SkitProps = {
  fps: number;
  width: number;
  height: number;
  seconds: number;
  set: SkitSet;
  line: SkitLine;
  text: string;
  words: CaptionWord[];
  history?: SkitMoment[];
  theme?: BoardTheme;
  colors?: BoardColors | null;
  glow?: BoardGlow;
  reserve?: CaptionReserve;
  language?: string;
  elements?: BoardElements;
  drawn?: SkitBoard | null;
  next?: SkitNext | null;
};

export const DEFAULT_SKIT_PROPS: SkitProps = {
  fps: 30,
  width: 1080,
  height: 1920,
  seconds: 4,
  set: {
    cast: [
      {
        id: "dev",
        name: "Dev",
        role: "Developer",
        voice: "male",
        wear: "hoodie",
        hair: "short",
        face: "glasses",
        colour: "blue",
        place: "left",
        stance: "sit",
        desk: "laptop",
      },
      {
        id: "pm",
        name: "Pat",
        role: "Product manager",
        voice: "female",
        wear: "shirt_tie",
        hair: "bun",
        face: "plain",
        colour: "orange",
        place: "right",
        stance: "stand",
      },
    ],
    card: { kind: "ticket", title: "Add a delete button", tags: [] },
    fields: [{ id: "points", label: "Points", value: 1 }],
  },
  line: { speaker: "pm", to: "dev" },
  text: "Can you add a small delete button?",
  words: [],
  theme: "night",
  reserve: "none",
};

interface FrameSpec {
  cardTop: number;
  cardTopCaptions: number;
  cardLeft: number;
  cardWidth: number;
  floor: number;
  floorCaptions: number;
  figure: number;
  margin: number;
}

const FRAMES: Record<"tall" | "wide", FrameSpec> = {
  tall: {
    cardTop: 0.06,
    cardTopCaptions: 0.2,
    cardLeft: 0.07,
    cardWidth: 0.86,
    floor: 0.9,
    floorCaptions: 0.78,
    figure: 0.34,
    margin: 0.04,
  },
  wide: {
    cardTop: 0.05,
    cardTopCaptions: 0.18,
    cardLeft: 0.29,
    cardWidth: 0.42,
    floor: 0.93,
    floorCaptions: 0.8,
    figure: 0.5,
    margin: 0.03,
  },
};

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SetView {
  left: number;
  span: number;
  floor: number;
  unit: number;
  room: { left: number; right: number; top: number };
  board: Box | null;
}

class SkitLayout {
  static readonly BESIDE = {
    tall: 0.25,
    wide: 0.42,
    column: 0.6,
    top: 0.04,
    least: 0.4,
    most: 0.58,
  };

  static of(width: number, height: number, reserve: CaptionReserve) {
    const spec = FRAMES[height > width ? "tall" : "wide"];
    const floor = height * (reserve === "bottom" ? spec.floorCaptions : spec.floor);
    const unit = (height * spec.figure) / Rig.HEIGHT;
    return {
      card: {
        x: width * spec.cardLeft,
        y: height * (reserve === "top" ? spec.cardTopCaptions : spec.cardTop),
        w: width * spec.cardWidth,
      },
      floor,
      unit,
      margin: width * spec.margin,
      frame: Math.min(width, height),
    };
  }

  static beside(width: number, height: number, reserve: CaptionReserve, text: string): SetView {
    const base = SkitLayout.of(width, height, reserve);
    const top = height * (reserve === "top" ? 0.16 : SkitLayout.BESIDE.top);
    if (height > width) {
      const unit = (height * SkitLayout.BESIDE.tall) / Rig.HEIGHT;
      const spot = base.floor + (Rig.head(POSE_SPECS.idle, 0)[1] - Rig.HEAD - 5) * unit;
      const gap = base.frame * 0.03;
      const used = text.trim() ? BubbleShape.need(text, width - base.margin * 2, base.frame) : 0;
      const bottom = Math.min(
        height * SkitLayout.BESIDE.most,
        Math.max(height * SkitLayout.BESIDE.least, spot - used - gap),
      );
      return {
        left: 0,
        span: width,
        floor: base.floor,
        unit,
        room: { left: base.margin, right: width - base.margin, top: bottom + gap },
        board: { x: base.margin, y: top, w: width - base.margin * 2, h: bottom - top },
      };
    }
    const column = width * SkitLayout.BESIDE.column;
    return {
      left: column,
      span: width - column,
      floor: base.floor,
      unit: (height * SkitLayout.BESIDE.wide) / Rig.HEIGHT,
      room: { left: column + base.margin * 0.4, right: width - base.margin, top },
      board: { x: base.margin, y: top, w: column - base.margin * 1.6, h: base.floor - top },
    };
  }

  static open(width: number, height: number, reserve: CaptionReserve, cardBottom: number): SetView {
    const base = SkitLayout.of(width, height, reserve);
    return {
      left: 0,
      span: width,
      floor: base.floor,
      unit: base.unit,
      room: { left: base.margin, right: width - base.margin, top: cardBottom },
      board: null,
    };
  }

  static mix(a: SetView, b: SetView, p: number): SetView {
    const m = (x: number, y: number) => x + (y - x) * p;
    return {
      left: m(a.left, b.left),
      span: m(a.span, b.span),
      floor: m(a.floor, b.floor),
      unit: m(a.unit, b.unit),
      room: {
        left: m(a.room.left, b.room.left),
        right: m(a.room.right, b.room.right),
        top: m(a.room.top, b.room.top),
      },
      board: b.board,
    };
  }
}

class SkitTiming {
  static readonly TURN = 0.25;
  static readonly POSE = 0.35;
  static readonly POSE_AT = 0.08;
  static readonly MOVE_AT = 0.15;
  static readonly STAND = 0.3;
  static readonly WALK = 2.4;
  static readonly STEP = 0.035;
  static readonly CUT = 0.45;
  static readonly BOARD = 0.74;

  static spoken(words: readonly CaptionWord[], seconds: number) {
    const first = words.length ? words[0].start : 0.2;
    const last = words.reduce((end, word) => Math.max(end, word.end), 0) || seconds * 0.8;
    return { first, last };
  }

  static settle(words: readonly CaptionWord[], seconds: number): number {
    const { last } = SkitTiming.spoken(words, seconds);
    return Math.max(SkitTiming.POSE_AT + SkitTiming.POSE, Math.min(last + 0.05, seconds - 0.4));
  }

  static changes(line: SkitLine, words: readonly CaptionWord[], seconds: number): number[] {
    const changes = line.card ?? [];
    if (!changes.length) return [];
    const { first, last } = SkitTiming.spoken(words, seconds);
    let floor = 0;
    return changes.map((change, i) => {
      const cued = change.cue ? BoardCues.at(words, change.cue) : -1;
      const at = cued >= 0 ? cued : first + ((last - first) * (i + 1)) / (changes.length + 1);
      floor = Math.max(floor, at);
      return floor;
    });
  }

  static talk(words: readonly CaptionWord[], t: number): number {
    return Math.max(
      0,
      ...words.map(
        (word) => Ease.clamp((t - word.start + 0.2) / 0.2) * Ease.clamp(1 - (t - word.end) / 0.35),
      ),
    );
  }

  static open(words: readonly CaptionWord[], t: number): number {
    const word = words.find((entry) => t >= entry.start && t < entry.end);
    return word ? 0.3 + 0.7 * Math.abs(Math.sin((t - word.start) * 14)) : 0;
  }
}

interface Placed {
  member: CastMember;
  x: number;
  dir: number;
  frame: FigureFrame;
  shown: boolean;
}

interface Span {
  left: number;
  span: number;
  width: number;
}

class CastMotion {
  static offX(member: CastMember, span: Span): number {
    return SkitPlaces.share(member.place) > 0.5 ? span.width * 1.2 : -span.width * 0.2;
  }

  static x(member: CastMember, place: Move, span: Span): number {
    return place === OFF
      ? CastMotion.offX(member, span)
      : span.left + SkitPlaces.share(place) * span.span;
  }

  static place(
    member: CastMember,
    line: SkitLine,
    before: MemberState,
    after: MemberState,
    words: readonly CaptionWord[],
    seconds: number,
    span: Span,
    board: number,
    t: number,
  ): Placed {
    const width = span.width;
    const act = (line.acts ?? []).find((entry) => entry.who === member.id);
    const speaker = line.speaker === member.id;
    const x0 = CastMotion.x(member, before.place, span);
    const x1 = CastMotion.x(member, after.place, span);
    const moving = Math.abs(x1 - x0) > 1;
    const standAt = before.stance === "sit" && after.stance === "stand" ? SkitTiming.MOVE_AT : -1;
    const sit =
      before.stance === "sit"
        ? standAt >= 0
          ? 1 - Ease.inOut(t, SkitTiming.STAND, standAt)
          : 1
        : after.stance === "sit"
          ? 1
          : 0;
    const walkAt = SkitTiming.MOVE_AT + (standAt >= 0 ? SkitTiming.STAND : 0);
    const walkFor = speaker
      ? Math.max(0.8, seconds - walkAt - 0.2)
      : Math.max(0.8, (Math.abs(x1 - x0) / width) * SkitTiming.WALK);
    const walked = moving ? Ease.inOut(t, walkFor, walkAt) : 1;
    const x = x0 + (x1 - x0) * walked;
    const walking = moving && t > walkAt && t < walkAt + walkFor;
    const settle = SkitTiming.settle(words, seconds);
    const presenting = speaker && line.draw === "beside";
    const talkPose = act?.pose ?? (speaker ? (presenting ? "present" : "talk") : before.pose);
    const fromPose = POSE_SPECS[before.pose];
    let pose = PoseMix.of(
      fromPose,
      POSE_SPECS[talkPose],
      Ease.inOut(t, SkitTiming.POSE, SkitTiming.POSE_AT),
    );
    if (speaker && !act?.pose) {
      pose = PoseMix.of(pose, POSE_SPECS[after.pose], Ease.inOut(t, SkitTiming.POSE, settle));
    }
    if (walking) pose = PoseMix.of(pose, POSE_SPECS.idle, 0.7);
    if (talkPose === "cheer") pose = { ...pose, hop: Math.abs(Math.sin(t * 6)) };
    const turnTo = walking ? Math.sign(x1 - x0) : after.facing;
    const turnAt = walking ? walkAt : moving ? walkAt + walkFor : 0.04;
    let dir = before.facing + (turnTo - before.facing) * Ease.inOut(t, SkitTiming.TURN, turnAt);
    if (presenting && board && !walking) {
      const look =
        Ease.inOut(t, SkitTiming.TURN, 0.04) * (1 - Ease.inOut(t, SkitTiming.TURN, settle));
      dir = dir + (board - dir) * look;
    }
    const talk = speaker ? SkitTiming.talk(words, t) : 0;
    const face =
      act?.face ?? (speaker && !act?.pose && t >= settle ? POSE_SPECS[after.pose].face : pose.face);
    const shown = !(before.place === OFF && after.place === OFF);
    return {
      member,
      x,
      dir: Math.abs(dir) < 0.08 ? (dir < 0 ? -0.08 : 0.08) : dir,
      shown,
      frame: {
        pose,
        face,
        open: speaker ? SkitTiming.open(words, t) : 0,
        blink: (t + member.id.length * 0.7) % 3.6 < 0.12,
        sit,
        walk: walking ? (Math.abs(x - x0) / (width * SkitTiming.STEP)) * Math.PI : 0,
        stride: walking ? 7 : 0,
        breath: t * 2 + member.id.length,
        talk: talk * (talkPose === "talk" ? 1 : 0.4),
      },
    };
  }
}

function SetLayer({
  set,
  line,
  text,
  words,
  history,
  width,
  height,
  seconds,
  reserve,
  palette,
  beside,
  besideView,
  t,
}: {
  set: SkitSet;
  line: SkitLine;
  text: string;
  words: readonly CaptionWord[];
  history: readonly SkitMoment[];
  width: number;
  height: number;
  seconds: number;
  reserve: CaptionReserve;
  palette: BoardPalette;
  beside: number;
  besideView: SetView | null;
  t: number;
}) {
  const layout = SkitLayout.of(width, height, reserve);
  const lines = useMemo(() => history.map((moment) => moment.line), [history]);
  const before = useMemo(() => SkitMemory.before(set, lines), [set, lines]);
  const after = useMemo(() => SkitMemory.after(set, before, line), [set, before, line]);
  const changeTimes = useMemo(
    () => SkitTiming.changes(line, words, seconds),
    [line, words, seconds],
  );
  let card: CardState | null = before.card;
  let cardFrom: CardState | null = before.card;
  let changed = -1;
  const changes = line.card ?? [];
  for (let i = 0; i < changes.length && card; i++) {
    if (t < changeTimes[i]) break;
    cardFrom = card;
    card = CardMemory.apply(card, changes[i]);
    changed = changeTimes[i];
  }
  const cardPlan =
    card && set.card
      ? CardLayout.plan(
          card,
          set.card.kind,
          layout.card.w,
          CardLayout.font(layout.frame),
          (set.fields ?? []).length,
        )
      : null;
  const cardBottom = cardPlan ? layout.card.y + cardPlan.h + layout.frame * 0.06 : layout.card.y;
  const open = SkitLayout.open(width, height, reserve, cardBottom);
  const view = besideView && beside > 0 ? SkitLayout.mix(open, besideView, beside) : open;
  const u = view.unit;
  const span = { left: view.left, span: view.span, width };
  const facingBoard = besideView && height <= width ? -1 : 0;
  const placed = set.cast
    .map((member) => {
      const was = before.members[member.id];
      const will = after.members[member.id];
      return was && will
        ? CastMotion.place(member, line, was, will, words, seconds, span, facingBoard, t)
        : null;
    })
    .filter((entry): entry is Placed => entry !== null);
  const headOf = (entry: Placed) => {
    const [hx, hy] = Rig.head(entry.frame.pose, entry.frame.sit);
    return { x: entry.x + hx * u * Math.sign(entry.dir), y: view.floor + hy * u };
  };
  const room = { ...view.room, width: view.room.right - view.room.left };
  const { first } = SkitTiming.spoken(words, seconds);
  const speaking = placed.find((entry) => entry.member.id === line.speaker);
  const last = history.at(-1);
  const lastSpeaker =
    last && !last.line.draw
      ? set.cast.find((member) => member.id === last.line.speaker)
      : undefined;
  const lastSpot = lastSpeaker
    ? (() => {
        const state = before.members[lastSpeaker.id];
        const x = CastMotion.x(lastSpeaker, state.place, span);
        const head = Rig.head(POSE_SPECS[state.pose], state.stance === "sit" ? 1 : 0);
        return {
          x: x + head[0] * u * state.facing,
          y: view.floor + (head[1] - Rig.HEAD - 5) * u,
        };
      })()
    : null;
  const chairs = set.cast.filter((member) => member.stance === "sit");
  const desks = set.cast.filter((member) => (member.desk ?? "none") !== "none");
  const anchorX = (member: CastMember) => CastMotion.x(member, member.place, span);
  const sitOf = (member: CastMember) =>
    placed.find((entry) => entry.member.id === member.id)?.frame.sit ?? 0;
  return (
    <AbsoluteFill>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {besideView?.board ? (
          <clipPath id="skit-set-clip">
            <rect
              x={height > width ? 0 : besideView.board.x + besideView.board.w}
              y={height > width ? besideView.board.y + besideView.board.h : 0}
              width={width}
              height={height}
            />
          </clipPath>
        ) : null}
        <g opacity={0.75 * (1 - beside)}>
          <SetBackdrop
            kind={set.backdrop ?? "plain"}
            room={{ width, floor: view.floor, unit: u }}
            palette={palette}
            t={t}
          />
        </g>
        {beside > 0 ? (
          <g opacity={0.6 * beside} clipPath="url(#skit-set-clip)">
            <SetBackdrop
              kind={set.backdrop ?? "plain"}
              room={{ width, floor: view.floor, unit: u }}
              palette={palette}
              t={t}
            />
          </g>
        ) : null}
        <line
          x1={0}
          y1={view.floor + u * 0.6}
          x2={width}
          y2={view.floor + u * 0.6}
          stroke={palette.muted}
          strokeOpacity={0.35}
          strokeWidth={Math.max(2, u * 0.8)}
        />
        {(set.props ?? []).map((prop) => (
          <g
            key={`${prop.kind}-${prop.place}`}
            transform={`translate(${view.left + SkitPlaces.share(prop.place) * view.span} ${view.floor}) scale(${u})`}
          >
            <SetPiece name={prop.kind} palette={palette} t={t} />
          </g>
        ))}
        {chairs.map((member) => (
          <g
            key={`chair-${member.id}`}
            transform={`translate(${anchorX(member)} ${view.floor}) scale(${u * SkitMemory.facing(member.place)} ${u})`}
          >
            <Chair ink={palette.muted} />
          </g>
        ))}
        {placed
          .filter((entry) => entry.shown)
          .map((entry) => (
            <g
              key={entry.member.id}
              transform={`translate(${entry.x} ${view.floor}) scale(${u * entry.dir} ${u})`}
            >
              <StickFigure
                member={entry.member}
                frame={entry.frame}
                palette={palette}
                mirror={entry.dir < 0}
              />
            </g>
          ))}
        {desks.map((member) => (
          <g
            key={`desk-${member.id}`}
            transform={`translate(${anchorX(member)} ${view.floor}) scale(${u * SkitMemory.facing(member.place)} ${u})`}
          >
            <DeskSet
              member={member}
              sit={member.stance === "sit" ? Math.max(0.5, sitOf(member)) : 0}
              ink={palette.ink}
              palette={palette}
              t={t}
            />
          </g>
        ))}
        {placed.map((entry) => {
          const act = (line.acts ?? []).find((item) => item.who === entry.member.id);
          if (!act?.react || !entry.shown) return null;
          const head = headOf(entry);
          return (
            <ReactionMark
              key={`react-${entry.member.id}`}
              reaction={act.react}
              x={head.x}
              y={head.y}
              size={u * 16}
              shown={ReactionTiming.shown(t, 0.18, seconds)}
              t={t}
              palette={palette}
            />
          );
        })}
      </svg>
      {card && cardFrom && set.card && beside < 1 ? (
        <RunningCard
          kind={set.card.kind}
          icon={set.card.icon}
          fields={set.fields ?? []}
          before={cardFrom}
          after={card}
          changed={changed}
          x={layout.card.x}
          y={layout.card.y}
          w={layout.card.w}
          frame={layout.frame}
          opacity={1 - beside}
          palette={palette}
          t={t}
          fade={Math.min(1, Math.max(0, (seconds - t) / CardLayout.BADGE_FADE))}
        />
      ) : null}
      {last && lastSpeaker && lastSpot ? (
        <SpeechBubble
          text={last.text}
          role={lastSpeaker.role}
          color={PAINTS[lastSpeaker.colour]}
          words={[]}
          t={t}
          from={-1}
          leave={0}
          spot={lastSpot}
          room={room}
          frame={layout.frame}
          palette={palette}
        />
      ) : null}
      {speaking ? (
        <SpeechBubble
          text={text}
          role={speaking.member.role}
          color={PAINTS[speaking.member.colour]}
          words={words}
          t={t}
          from={Math.max(0.12, first - 0.12)}
          leave={-1}
          spot={(() => {
            const head = headOf(speaking);
            return { x: head.x, y: head.y - (Rig.HEAD + 5) * u };
          })()}
          room={room}
          frame={layout.frame}
          palette={palette}
        />
      ) : null}
    </AbsoluteFill>
  );
}

function FullSpeaker({
  set,
  line,
  words,
  width,
  height,
  palette,
  t,
}: {
  set: SkitSet;
  line: SkitLine;
  words: readonly CaptionWord[];
  width: number;
  height: number;
  palette: BoardPalette;
  t: number;
}) {
  const member = set.cast.find((entry) => entry.id === line.speaker);
  if (!member) return null;
  const strip = height * (1 - SkitTiming.BOARD);
  const u = (strip * 0.86) / Rig.HEIGHT;
  const x = width * 0.18;
  const floor = height - strip * 0.05;
  const talk = SkitTiming.talk(words, t);
  const pose = PoseMix.of(POSE_SPECS.idle, POSE_SPECS.point, Ease.inOut(t, 0.4, 0.3));
  const chip = Math.min(width, height) * 0.03;
  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(${x} ${floor}) scale(${u} ${u})`}>
          <StickFigure
            member={member}
            frame={{
              pose,
              face: "neutral",
              open: SkitTiming.open(words, t),
              blink: t % 3.6 < 0.12,
              sit: 0,
              walk: 0,
              stride: 0,
              breath: t * 2,
              talk,
            }}
            palette={palette}
          />
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          left: x + u * 22,
          top: floor - strip * 0.8,
          fontFamily: BOARD_FONT,
          fontSize: chip,
          fontWeight: 900,
          letterSpacing: chip * 0.08,
          textTransform: "uppercase",
          color: palette.background,
          background: PAINTS[member.colour],
          borderRadius: chip * 0.5,
          padding: `${chip * 0.18}px ${chip * 0.55}px`,
          whiteSpace: "nowrap",
        }}
      >
        {member.role}
      </div>
    </>
  );
}

export function SkitScene(props: SkitProps) {
  const frame = useCurrentFrame();
  return <SkitMomentView {...props} t={frame / props.fps} />;
}

function BoardFrame({
  box,
  drawn,
  fps,
  seconds,
  words,
  theme,
  colors,
  language,
  elements,
  palette,
  shown,
  t,
}: {
  box: Box;
  drawn: SkitBoard;
  fps: number;
  seconds: number;
  words: CaptionWord[];
  theme?: BoardTheme;
  colors?: BoardColors | null;
  language: string;
  elements?: BoardElements;
  palette: BoardPalette;
  shown: number;
  t: number;
}) {
  const edge = Math.max(3, Math.min(box.w, box.h) * 0.008);
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        opacity: shown,
        transform: `translateY(${(1 - shown) * -box.h * 0.08}px) scale(${0.96 + shown * 0.04})`,
        borderRadius: edge * 5,
        border: `${edge}px solid ${palette.accent}66`,
        boxShadow: palette.glow ? `0 0 ${edge * 6 * palette.glow}px ${palette.accent}33` : "none",
        overflow: "hidden",
      }}
    >
      <BoardMoment
        fps={fps}
        width={box.w - edge * 2}
        height={box.h - edge * 2}
        seconds={seconds}
        board={drawn.board}
        words={words}
        theme={theme}
        colors={colors}
        mascot={null}
        reserve="none"
        stage={drawn.stage ?? null}
        history={drawn.history ?? []}
        language={language}
        elements={elements}
        t={t}
      />
    </div>
  );
}

export function SkitMomentView({
  fps,
  width,
  height,
  seconds,
  set,
  line,
  text,
  words,
  history = [],
  theme,
  colors,
  glow,
  reserve = "none",
  language = "en",
  elements,
  drawn,
  next,
  t,
}: SkitProps & { t: number }) {
  const palette = BoardThemes.of(theme, colors, glow);
  const spoken = text.trim() || words.map((word) => word.word).join(" ");
  const before = history.at(-1)?.line.draw;
  const full = line.draw === "full" && !!drawn;
  const besideNow = line.draw === "beside" && !!drawn;
  const back = !full && before === "full";
  const away = full ? Ease.inOut(t, SkitTiming.CUT) : back ? 1 - Ease.inOut(t, SkitTiming.CUT) : 0;
  const beside = besideNow
    ? (before === "beside" ? 1 : Ease.inOut(t, SkitTiming.CUT)) *
      (next?.draw === "beside" ? 1 : 1 - Ease.inOut(t, SkitTiming.CUT, seconds - SkitTiming.CUT))
    : 0;
  const besideView = besideNow ? SkitLayout.beside(width, height, reserve, spoken) : null;
  const boardHeight = height * SkitTiming.BOARD;
  return (
    <BoardElementsContext.Provider value={elements ?? {}}>
      <AbsoluteFill
        style={{ backgroundColor: palette.background, fontFamily: BOARD_FONT, overflow: "hidden" }}
      >
        {full && drawn ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width,
              height: boardHeight,
              opacity: away,
            }}
          >
            <BoardMoment
              fps={fps}
              width={width}
              height={boardHeight}
              seconds={seconds}
              board={drawn.board}
              words={words}
              theme={theme}
              colors={colors}
              mascot={null}
              reserve={reserve === "top" ? "top" : "none"}
              stage={drawn.stage ?? null}
              history={drawn.history ?? []}
              language={language}
              elements={elements}
              t={t}
            />
          </div>
        ) : null}
        {full ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: away * (1 - Ease.inOut(t, SkitTiming.CUT, seconds - SkitTiming.CUT)),
            }}
          >
            <FullSpeaker
              set={set}
              line={line}
              words={words}
              width={width}
              height={height}
              palette={palette}
              t={t}
            />
          </div>
        ) : null}
        {besideNow && drawn && besideView?.board ? (
          <BoardFrame
            box={besideView.board}
            drawn={drawn}
            fps={fps}
            seconds={seconds}
            words={words}
            theme={theme}
            colors={colors}
            language={language}
            elements={elements}
            palette={palette}
            shown={beside}
            t={t}
          />
        ) : null}
        {away < 1 ? (
          <AbsoluteFill
            style={{
              opacity: 1 - away,
              transform: `translateY(${away * height * 0.5}px)`,
            }}
          >
            <SetLayer
              set={set}
              line={full ? { speaker: line.speaker, to: line.to } : line}
              text={full ? "" : spoken}
              words={full ? [] : words}
              history={history}
              width={width}
              height={height}
              seconds={seconds}
              reserve={reserve}
              palette={palette}
              beside={beside}
              besideView={besideView}
              t={t}
            />
          </AbsoluteFill>
        ) : null}
      </AbsoluteFill>
    </BoardElementsContext.Provider>
  );
}

export const skitCalcMeta: CalculateMetadataFunction<SkitProps> = ({ props }) => ({
  durationInFrames: Math.max(1, Math.round(props.seconds * props.fps)),
  fps: props.fps,
  width: props.width,
  height: props.height,
});
