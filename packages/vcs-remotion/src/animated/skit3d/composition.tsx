import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useMemo } from "react";
import { AbsoluteFill, type CalculateMetadataFunction, useCurrentFrame } from "remotion";
import type { PerspectiveCamera } from "three";
import type { CaptionWord } from "../../captions.ts";
import type { CaptionReserve } from "../explainer/spec.ts";
import { Ease } from "../shared/ease.ts";
import { FitText } from "../shared/fit-text.ts";
import { BOARD_FONT, type BoardColors, type BoardTheme, BoardThemes, PAINTS } from "../shared/theme.ts";
import { Actor3D, ActorMotion, type ActorPlan, ActorPlanner } from "./actor.tsx";
import { type CameraPlace, type Cover, ShotPlanner } from "./camera.ts";
import { useModelFiles } from "./models.ts";
import {
  type CastMember3D,
  CastScale,
  OFF,
  type RiggedModel,
  type SceneModels,
  type Skit3DLine,
  type Skit3DSet,
} from "./spec.ts";
import { Ground3D, Props3D } from "./stage.tsx";
import { Stage3DMemory, StageSpots } from "./state.ts";

export const SKIT3D_COMPOSITION_ID = "Skit3DScene";

export interface Skit3DMoment {
  line: Skit3DLine;
  text: string;
}

export type Skit3DProps = {
  fps: number;
  width: number;
  height: number;
  seconds: number;
  set: Skit3DSet;
  line: Skit3DLine;
  text: string;
  words: CaptionWord[];
  models: SceneModels;
  history?: Skit3DMoment[];
  theme?: BoardTheme;
  colors?: BoardColors | null;
  reserve?: CaptionReserve;
  language?: string;
};

export const DEFAULT_SKIT3D_PROPS: Skit3DProps = {
  fps: 30,
  width: 1280,
  height: 720,
  seconds: 4,
  set: {
    ground: "room",
    cast: [
      { id: "leo", name: "Leo", role: "Owner", voice: "male", look: "robot", colour: "yellow", place: "left" },
      { id: "mia", name: "Mia", role: "Fixer", voice: "female", look: "robot", colour: "blue", place: "right" },
    ],
  },
  line: { speaker: "leo", to: "mia", acts: [{ who: "leo", act: "wave" }] },
  text: "Hey Mia, is the fridge fixed?",
  words: [],
  models: {},
  theme: "paper",
  reserve: "none",
};

export class LineTiming {
  static spoken(words: readonly CaptionWord[], seconds: number) {
    const first = words.length ? words[0].start : 0.2;
    const last = words.reduce((end, word) => Math.max(end, word.end), 0) || seconds * 0.8;
    return { first, last };
  }
}

class StagePlans {
  static gap(width: number, height: number): number {
    return width >= height ? StageSpots.GAP : StageSpots.TALL_GAP;
  }

  static build(props: Skit3DProps, lengths: (look: string, name: string) => number): ActorPlan[] {
    const { set, line, words, seconds } = props;
    const gap = StagePlans.gap(props.width, props.height);
    const state = Stage3DMemory.before(set, (props.history ?? []).map((moment) => moment.line));
    const { first, last } = LineTiming.spoken(words, seconds);
    const plans = new Map<string, ActorPlan>();
    for (const member of set.cast) {
      const model = props.models[member.look];
      if (model?.kind !== "rig") continue;
      const now = state[member.id];
      const act = Stage3DMemory.act(line, member.id);
      const entering = now.place === OFF && Stage3DMemory.joins(line, member, act?.move);
      const target = act?.move ?? (entering ? member.place : now.place);
      const home = StageSpots.x(member.place, gap);
      const fromX = now.place === OFF ? StageSpots.wing(member.place, home) : StageSpots.x(now.place, gap);
      const toX = target === OFF ? StageSpots.wing(member.place, fromX) : StageSpots.x(target, gap);
      const walks = Math.abs(toX - fromX) > 0.01;
      const walkStart = walks ? ActorPlanner.MOVE_AT : 0;
      const walkEnd = walks ? walkStart + Math.abs(toX - fromX) / ActorPlanner.WALK_SPEED : 0;
      const speaks = line.speaker === member.id;
      const ready = walks ? walkEnd + ActorPlanner.SETTLE : 0;
      const at = Math.max(speaks ? first : first + ActorPlanner.REACT, ready);
      const speech = speaks ? { start: Math.max(first, ready), end: Math.max(last, ready + 0.1) } : null;
      const rest = now.sits && !walks && model.clips.sit ? "sit" : "idle";
      const spans = ActorPlanner.spans(
        model,
        rest,
        walks ? { start: walkStart, end: walkEnd } : null,
        act?.act ? { action: act.act, at } : null,
        speech,
        (name) => lengths(member.look, name),
      );
      plans.set(member.id, {
        member,
        fromX,
        toX,
        walkStart,
        walkEnd,
        spans,
        face: act?.face && act.face !== "neutral" ? act.face : null,
        faceAt: at,
        speaking: speaks,
        lookAt: () => null,
        shown: now.place !== OFF || target !== OFF,
        stays: target !== OFF,
      });
    }
    for (const plan of plans.values()) {
      const id = plan.member.id;
      const partner = StagePlans.partner(plans, line, id);
      plan.lookAt = (t) => (partner ? ActorMotion.x(partner, t) : null);
    }
    return [...plans.values()];
  }

  static partner(plans: Map<string, ActorPlan>, line: Skit3DLine, id: string): ActorPlan | null {
    const wanted = id === line.speaker ? line.to : line.speaker;
    const named = wanted && wanted !== id ? plans.get(wanted) : undefined;
    if (named?.shown) return named;
    const me = plans.get(id);
    if (!me) return null;
    const others = [...plans.values()].filter((plan) => plan.member.id !== id && plan.shown);
    others.sort((a, b) => Math.abs(a.toX - me.toX) - Math.abs(b.toX - me.toX));
    return others[0] ?? null;
  }
}

export class BubbleLayout {
  static readonly NAME = 0.042;
  static readonly NAME_PAD = 0.2;
  static readonly NAME_GAP = 0.3;
  static readonly EDGE = 0.05;
  static readonly WIDTH = 0.84;
  static readonly BOX = 0.15;
  static readonly LEAST_FONT = 0.028;
  static readonly MOST_FONT = 0.045;
  static readonly LINES = 3;
  static readonly CAPTIONS = 0.22;

  static frame(width: number, height: number): number {
    return Math.min(width, height);
  }

  static name(width: number, height: number): number {
    return Math.round(BubbleLayout.frame(width, height) * BubbleLayout.NAME);
  }

  static cover(width: number, height: number, reserve: CaptionReserve): Cover {
    if (reserve === "top") return { top: BubbleLayout.CAPTIONS, bottom: 0 };
    if (reserve === "bottom") return { top: 0, bottom: BubbleLayout.CAPTIONS };
    const frame = BubbleLayout.frame(width, height);
    const name = BubbleLayout.name(width, height);
    const used =
      frame * BubbleLayout.EDGE + name * (1 + 2 * BubbleLayout.NAME_PAD + BubbleLayout.NAME_GAP) + height * BubbleLayout.BOX;
    return { top: 0, bottom: used / height };
  }
}

class Framing {
  static of(props: Skit3DProps, plans: readonly ActorPlan[], t: number): CameraPlace {
    const shown = plans.filter((plan) => plan.shown && plan.stays);
    const speaker = shown.find((plan) => plan.member.id === props.line.speaker) ?? shown[0];
    const tall = (plan: ActorPlan) => ActorMotion.HEIGHT * CastScale.of(plan.member);
    const aspect = props.width / props.height;
    const cover = BubbleLayout.cover(props.width, props.height, props.reserve ?? "none");
    if (!speaker) {
      return ShotPlanner.place("wide", [{ x: 0, tall: ActorMotion.HEIGHT }], 0, aspect, cover, 0);
    }
    const partner = StagePlans.partner(new Map(shown.map((plan) => [plan.member.id, plan])), props.line, speaker.member.id);
    const walking = plans.some((plan) => plan.walkEnd > plan.walkStart);
    const shot = ShotPlanner.pick(
      props.line.shot,
      walking,
      !(props.history ?? []).length,
      shown.length - 1,
      (props.history ?? []).length,
    );
    const subjects =
      shot === "close" ? [speaker] : shot === "two" && partner ? [speaker, partner] : shown;
    const side = partner ? Math.sign(partner.toX - speaker.toX) : 0;
    return ShotPlanner.place(
      shot,
      subjects.map((plan) => ({ x: plan.toX, tall: tall(plan) })),
      side,
      aspect,
      cover,
      Ease.clamp(t / Math.max(props.seconds, 0.1)),
    );
  }
}

function CameraRig({ place }: { place: CameraPlace }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  camera.fov = place.fov;
  camera.position.set(...place.position);
  camera.lookAt(...place.target);
  camera.updateProjectionMatrix();
  return null;
}

function LineBubble({
  member,
  text,
  words,
  t,
  width,
  height,
  reserve,
}: {
  member: CastMember3D | undefined;
  text: string;
  words: readonly CaptionWord[];
  t: number;
  width: number;
  height: number;
  reserve: CaptionReserve;
}) {
  if (!member) return null;
  const frame = BubbleLayout.frame(width, height);
  const colour = PAINTS[member.colour];
  const pop = Ease.pop(t, 0.3);
  const name = BubbleLayout.name(width, height);
  const chip = (
    <div
      style={{
        display: "inline-block",
        background: colour,
        color: BoardThemes.readable(colour),
        fontFamily: BOARD_FONT,
        fontWeight: 800,
        fontSize: name,
        lineHeight: 1,
        padding: `${name * BubbleLayout.NAME_PAD}px ${name * 0.55}px`,
        borderRadius: name * 0.5,
        transform: `scale(${pop})`,
        transformOrigin: "left center",
      }}
    >
      {member.name}
    </div>
  );
  if (reserve !== "none") {
    return (
      <AbsoluteFill
        style={{
          justifyContent: reserve === "bottom" ? "flex-start" : "flex-end",
          padding: frame * BubbleLayout.EDGE,
        }}
      >
        <div>{chip}</div>
      </AbsoluteFill>
    );
  }
  const box = { w: width * BubbleLayout.WIDTH, h: height * BubbleLayout.BOX };
  const font = Math.max(
    frame * BubbleLayout.LEAST_FONT,
    FitText.size(text, box, frame * BubbleLayout.MOST_FONT, BubbleLayout.LINES),
  );
  const tokens = text.split(/\s+/).filter(Boolean);
  const said = words.filter((word) => word.start <= t).length;
  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: frame * BubbleLayout.EDGE }}
    >
      <div style={{ width: box.w, transform: `translateY(${(1 - pop) * frame * 0.03}px)`, opacity: pop }}>
        {chip}
        <div
          style={{
            marginTop: name * BubbleLayout.NAME_GAP,
            background: "rgba(255,253,248,0.96)",
            borderRadius: font * 0.6,
            borderLeft: `${Math.max(4, font * 0.22)}px solid ${colour}`,
            padding: `${font * 0.45}px ${font * 0.7}px`,
            fontFamily: BOARD_FONT,
            fontWeight: 700,
            fontSize: font,
            lineHeight: FitText.LEADING,
            color: "#1D1D1D",
            boxShadow: "0 0.25em 0 rgba(0,0,0,0.12)",
          }}
        >
          {tokens.map((token, i) => (
            <span key={i} style={{ opacity: !words.length || i < said ? 1 : 0.28 }}>
              {token}{" "}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function Skit3DMomentView(props: Skit3DProps & { t: number }) {
  const { t, width, height } = props;
  const rigs = useMemo(
    () => Object.values(props.models).flatMap((model) => (model.kind === "parts" ? [] : [model.url])),
    [props.models],
  );
  const files = useModelFiles(rigs);
  const plans = useMemo(() => {
    if (!files) return [];
    const lengths = (look: string, name: string) => {
      const model = props.models[look] as RiggedModel | undefined;
      const clip = model ? files[model.url]?.animations.find((c) => c.name === name) : undefined;
      return clip?.duration ?? 1;
    };
    return StagePlans.build(props, lengths);
  }, [files, props]);
  if (!files) return null;
  const palette = BoardThemes.of(props.theme, props.colors);
  const place = Framing.of(props, plans, t);
  const speaker = props.set.cast.find((member) => member.id === props.line.speaker);
  return (
    <AbsoluteFill>
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        camera={{ fov: place.fov, position: place.position }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <CameraRig place={place} />
        <Ground3D ground={props.set.ground} palette={palette} />
        <Props3D props={props.set.props ?? []} models={props.models} files={files} />
        {plans.map((plan) => {
          const model = props.models[plan.member.look] as RiggedModel;
          return (
            <Actor3D
              key={plan.member.id}
              gltf={files[model.url]}
              model={model}
              plan={plan}
              words={plan.speaking ? props.words : []}
              t={t}
            />
          );
        })}
      </ThreeCanvas>
      <LineBubble
        member={speaker}
        text={props.text}
        words={props.words}
        t={t}
        width={width}
        height={height}
        reserve={props.reserve ?? "none"}
      />
    </AbsoluteFill>
  );
}

export function Skit3DScene(props: Skit3DProps) {
  const frame = useCurrentFrame();
  return <Skit3DMomentView {...props} t={frame / props.fps} />;
}

export const skit3dCalcMeta: CalculateMetadataFunction<Skit3DProps> = ({ props }) => ({
  durationInFrames: Math.max(1, Math.round(props.seconds * props.fps)),
  fps: props.fps,
  width: props.width,
  height: props.height,
});
