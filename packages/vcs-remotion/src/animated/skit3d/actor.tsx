import { useMemo } from "react";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { CaptionWord } from "../../captions.ts";
import { Ease } from "../shared/ease.ts";
import { PAINTS } from "../shared/theme.ts";
import { ModelFiles, ModelFit } from "./models.ts";
import { type Action, type CastMember3D, CastScale, type Face, type RiggedModel } from "./spec.ts";

export interface ClipSpan {
  start: number;
  name: string;
  loop: boolean;
}

export interface ActorPlan {
  member: CastMember3D;
  fromX: number;
  toX: number;
  walkStart: number;
  walkEnd: number;
  spans: ClipSpan[];
  face: Face | null;
  faceAt: number;
  speaking: boolean;
  lookAt: (t: number) => number | null;
  shown: boolean;
  stays: boolean;
}

export class ActorMotion {
  static readonly BLEND = 0.3;
  static readonly TURN_SECONDS = 0.35;
  static readonly FACING = 0.95;
  static readonly WALKING = Math.PI / 2;
  static readonly HEIGHT = 1.75;
  static readonly LOOPS: ReadonlySet<string> = new Set(["idle", "talk", "walk", "dance", "sit"]);
  static readonly SPEECH_RAMP = 0.35;
  static readonly HEAD = { nod: 0.035, tilt: 0.025, nodSpeed: 3.4, tiltSpeed: 1.7 };
  static readonly BODY = { sway: 0.018, swaySpeed: 1.3 };

  static x(plan: ActorPlan, t: number): number {
    if (plan.walkEnd <= plan.walkStart) return plan.toX;
    const k = Ease.clamp((t - plan.walkStart) / (plan.walkEnd - plan.walkStart));
    return plan.fromX + (plan.toX - plan.fromX) * k;
  }

  static walking(plan: ActorPlan, t: number): boolean {
    return plan.walkEnd > plan.walkStart && t >= plan.walkStart && t < plan.walkEnd;
  }

  static turn(plan: ActorPlan, t: number): number {
    const x = ActorMotion.x(plan, t);
    if (ActorMotion.walking(plan, t)) return Math.sign(plan.toX - plan.fromX) * ActorMotion.WALKING;
    const target = plan.lookAt(t);
    const facing = target === null || Math.abs(target - x) < 0.05 ? 0 : Math.sign(target - x) * ActorMotion.FACING;
    if (plan.walkEnd <= plan.walkStart || t < plan.walkEnd) return facing;
    const k = Ease.inOut(t - plan.walkEnd, ActorMotion.TURN_SECONDS);
    const walked = Math.sign(plan.toX - plan.fromX) * ActorMotion.WALKING;
    return walked + (facing - walked) * k;
  }

  static current(spans: readonly ClipSpan[], t: number): { now: ClipSpan; before: ClipSpan | null } {
    let index = 0;
    for (let i = 0; i < spans.length; i++) if (spans[i].start <= t) index = i;
    return { now: spans[index], before: index > 0 ? spans[index - 1] : null };
  }

  static voiced(words: readonly CaptionWord[], t: number): number {
    if (!words.length) return 0;
    const first = words[0].start;
    const last = words.reduce((end, word) => Math.max(end, word.end), first);
    const ramp = ActorMotion.SPEECH_RAMP;
    return Ease.clamp((t - first + ramp) / ramp) * Ease.clamp(1 - (t - last) / ramp);
  }

  static calm(now: ClipSpan, before: ClipSpan | null, blend: number): number {
    if (now.loop) return before && !before.loop ? blend : 1;
    return before?.loop ? 1 - blend : 0;
  }

  static mouth(words: readonly CaptionWord[], t: number): number {
    const word = words.find((entry) => t >= entry.start && t < entry.end);
    return word ? 0.25 + 0.75 * Math.abs(Math.sin((t - word.start) * 13)) : 0;
  }
}

interface Rig {
  holder: THREE.Group;
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  morphs: THREE.Mesh[];
  head: THREE.Object3D | null;
  body: THREE.Object3D | null;
  rest: Map<THREE.Object3D, THREE.Quaternion>;
}

class RigBuilder {
  static build(gltf: GLTF, model: RiggedModel, member: CastMember3D): Rig {
    const root = ModelFiles.copy(gltf);
    ModelFit.shadows(root);
    if (model.tint) RigBuilder.tint(root, model.tint, PAINTS[member.colour]);
    const holder = ModelFit.standOn(root, ActorMotion.HEIGHT * CastScale.of(member));
    const mixer = new THREE.AnimationMixer(root);
    const actions = new Map<string, THREE.AnimationAction>();
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip);
      action.play();
      action.setEffectiveWeight(0);
      actions.set(clip.name, action);
    }
    const morphs: THREE.Mesh[] = [];
    let head: THREE.Object3D | null = null;
    let body: THREE.Object3D | null = null;
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary) morphs.push(mesh);
      if (!(node as THREE.Bone).isBone) return;
      if (!head && RigBuilder.HEAD.test(node.name)) head = node;
      if (!body && RigBuilder.BODY.test(node.name)) body = node;
    });
    const rest = new Map<THREE.Object3D, THREE.Quaternion>();
    for (const bone of [head, body]) if (bone) rest.set(bone, (bone as THREE.Object3D).quaternion.clone());
    return { holder, root, mixer, actions, morphs, head, body, rest };
  }

  static readonly HEAD = /head/i;
  static readonly BODY = /chest|spine|torso/i;

  static tint(root: THREE.Object3D, name: string, colour: string): void {
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const swap = (material: THREE.Material) => {
        if (material.name !== name) return material;
        const own = material.clone() as THREE.MeshStandardMaterial;
        own.color = new THREE.Color(colour);
        return own;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    });
  }
}

export function Actor3D({
  gltf,
  model,
  plan,
  words,
  t,
}: {
  gltf: GLTF;
  model: RiggedModel;
  plan: ActorPlan;
  words: readonly CaptionWord[];
  t: number;
}) {
  const rig = useMemo(() => RigBuilder.build(gltf, model, plan.member), [gltf, model, plan.member]);
  for (const action of rig.actions.values()) action.setEffectiveWeight(0);
  const { now, before } = ActorMotion.current(plan.spans, t);
  const blend = before ? Ease.clamp((t - now.start) / ActorMotion.BLEND) : 1;
  const drive = (span: ClipSpan, weight: number) => {
    const action = rig.actions.get(span.name);
    if (!action) return;
    const length = action.getClip().duration;
    const local = Math.max(0, t - span.start);
    action.time = span.loop ? local % length : Math.min(local, length - 0.001);
    action.setEffectiveWeight(weight);
  };
  drive(now, blend);
  if (before && blend < 1) drive(before, 1 - blend);
  for (const [bone, pose] of rig.rest) bone.quaternion.copy(pose);
  rig.mixer.update(0);

  const ownTalk = !!model.clips.talk && now.name === model.clips.talk;
  const talking = plan.speaking && !ownTalk ? ActorMotion.voiced(words, t) * ActorMotion.calm(now, before, blend) : 0;
  if (talking > 0) {
    const { HEAD, BODY } = ActorMotion;
    rig.head?.rotateX(Math.sin(t * HEAD.nodSpeed) * HEAD.nod * talking);
    rig.head?.rotateZ(Math.sin(t * HEAD.tiltSpeed) * HEAD.tilt * talking);
    rig.body?.rotateY(Math.sin(t * BODY.swaySpeed) * BODY.sway * talking);
  }
  const faceMorph = plan.face ? model.faces?.[plan.face] : undefined;
  const faceLevel = plan.face ? Ease.out(t, 0.25, plan.faceAt) : 0;
  const mouthLevel = plan.speaking ? ActorMotion.mouth(words, t) : 0;
  for (const mesh of rig.morphs) {
    const dict = mesh.morphTargetDictionary ?? {};
    const levels = mesh.morphTargetInfluences;
    if (!levels) continue;
    levels.fill(0);
    if (faceMorph && dict[faceMorph] !== undefined) levels[dict[faceMorph]] = faceLevel;
    if (model.mouth && dict[model.mouth] !== undefined) levels[dict[model.mouth]] = mouthLevel;
  }

  rig.holder.position.set(ActorMotion.x(plan, t), 0, 0);
  rig.holder.rotation.y = ActorMotion.turn(plan, t);
  rig.holder.visible = plan.shown;
  return <primitive object={rig.holder} />;
}

export class ActorPlanner {
  static readonly WALK_SPEED = 1.5;
  static readonly MOVE_AT = 0.15;
  static readonly REACT = 0.5;
  static readonly SETTLE = 0.2;

  static spans(
    model: RiggedModel,
    rest: "idle" | "sit",
    walk: { start: number; end: number } | null,
    act: { action: Action; at: number } | null,
    speech: { start: number; end: number } | null,
    clipLength: (name: string) => number,
  ): ClipSpan[] {
    const clip = (action: string) => model.clips[action];
    const restName = clip(rest) ?? clip("idle") ?? Object.values(model.clips)[0] ?? "";
    const spans: ClipSpan[] = [{ start: 0, name: restName, loop: true }];
    const talkName = clip("talk");
    if (walk && clip("walk")) {
      spans.push({ start: walk.start, name: clip("walk"), loop: true });
      spans.push({ start: walk.end, name: restName, loop: true });
    }
    if (speech && talkName && !act) {
      spans.push({ start: speech.start, name: talkName, loop: true });
      spans.push({ start: speech.end, name: restName, loop: true });
    }
    if (act && act.action !== "idle") {
      const name = act.action === "talk" ? talkName : clip(act.action);
      if (name) {
        const loop = ActorMotion.LOOPS.has(act.action);
        spans.push({ start: act.at, name, loop });
        if (!loop) {
          const after = speech && talkName && act.at + clipLength(name) < speech.end ? talkName : restName;
          spans.push({ start: act.at + clipLength(name), name: after, loop: true });
          if (after === talkName && speech) spans.push({ start: speech.end, name: restName, loop: true });
        } else if (act.action === "talk" && speech) {
          spans.push({ start: speech.end, name: restName, loop: true });
        }
      }
    }
    return spans.sort((a, b) => a.start - b.start);
  }
}
