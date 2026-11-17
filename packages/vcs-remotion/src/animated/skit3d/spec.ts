import { z } from "zod";
import { STAGE_REF, picture, slug, text } from "../shared/fields.ts";
import { PAINT_NAMES } from "../shared/theme.ts";

export const SKIT3D_LIMITS = {
  cast: 4,
  name: 24,
  role: 18,
  props: 8,
  acts: 4,
  lines: 80,
  parts: 24,
  size: 4,
} as const;

export const PLACES = ["far_left", "left", "center", "right", "far_right"] as const;
export const SPOTS = [
  "back_left",
  "back_center",
  "back_right",
  "side_left",
  "side_right",
  "front_left",
  "front_right",
] as const;
export const GROUNDS = ["room", "street", "park", "stage", "space", "plain"] as const;
export const AGES = ["child", "teen", "adult", "elder"] as const;
export const HEIGHTS = ["short", "average", "tall"] as const;
export const VOICE_KINDS = ["female", "male"] as const;
export const ACTIONS = [
  "idle",
  "talk",
  "wave",
  "point",
  "yes",
  "no",
  "think",
  "shrug",
  "cheer",
  "jump",
  "thumbs_up",
  "dance",
  "sit",
  "punch",
  "fall",
  "pick_up",
] as const;
export const HELD = ["sit", "fall"] as const;
export const FACES = ["neutral", "happy", "sad", "angry", "surprised"] as const;
export const SHOTS = ["auto", "close", "two", "wide"] as const;
export const OFF = "off";
export const MOVES = [...PLACES, OFF] as const;
export const SHAPES = ["box", "ball", "tube", "cone", "ring"] as const;

export const ACTION_CLIPS: Record<(typeof ACTIONS)[number], readonly string[]> = {
  idle: ["idle", "breathing", "stand"],
  talk: ["talk", "talking", "speak", "conversation"],
  wave: ["wave", "waving", "greet", "hello"],
  point: ["point", "pointing", "interact"],
  yes: ["yes", "nod", "agree", "emote-yes"],
  no: ["no", "shake", "disagree", "emote-no"],
  think: ["think", "thinking", "ponder"],
  shrug: ["shrug"],
  cheer: ["cheer", "victory", "celebrate", "win"],
  jump: ["jump"],
  thumbs_up: ["thumbsup", "thumbs_up", "thumbs-up", "like"],
  dance: ["dance", "dancing"],
  sit: ["sit", "sitting", "seated"],
  punch: ["punch", "attack", "hit"],
  fall: ["death", "die", "fall", "knocked"],
  pick_up: ["pick-up", "pickup", "pick_up", "grab", "interact"],
};
export const WALK_CLIPS = ["walk", "walking"] as const;
export const BUILT_IN = { actions: ["idle", "talk"], faces: ["neutral"] } as const;
export const FACE_MORPHS: Record<(typeof FACES)[number], readonly string[]> = {
  neutral: [],
  happy: ["happy", "smile", "joy"],
  sad: ["sad", "frown"],
  angry: ["angry", "mad"],
  surprised: ["surprised", "surprise", "shock", "wow"],
};
export const MOUTH_MORPHS = ["mouth_open", "mouthopen", "jawopen", "open", "aa", "viseme_aa"] as const;

export type Place = (typeof PLACES)[number];
export type Spot = (typeof SPOTS)[number];
export type Ground = (typeof GROUNDS)[number];
export type Action = (typeof ACTIONS)[number];
export type Rest = "idle" | (typeof HELD)[number];
export type Face = (typeof FACES)[number];
export type Shot = (typeof SHOTS)[number];
export type Move = (typeof MOVES)[number];
export type Shape = (typeof SHAPES)[number];

const castRef = slug.meta({ [STAGE_REF]: "cast" });
const unit = z.number().min(-SKIT3D_LIMITS.size).max(SKIT3D_LIMITS.size);
const size = z.number().min(0.02).max(SKIT3D_LIMITS.size);

export const castSchema = z.object({
  id: slug,
  name: text(SKIT3D_LIMITS.name),
  role: text(SKIT3D_LIMITS.role),
  voice: z.enum(VOICE_KINDS),
  look: picture,
  colour: z.enum(PAINT_NAMES),
  place: z.enum(PLACES),
  age: z.enum(AGES).optional(),
  height: z.enum(HEIGHTS).optional(),
  enters: z.boolean().optional(),
});
export type CastMember3D = z.infer<typeof castSchema>;

export const propSchema = z.object({
  kind: picture,
  spot: z.enum(SPOTS),
});
export type PropPick = z.infer<typeof propSchema>;

export const setSchema = z.object({
  ground: z.enum(GROUNDS),
  cast: z.array(castSchema).min(1).max(SKIT3D_LIMITS.cast),
  props: z.array(propSchema).max(SKIT3D_LIMITS.props).optional(),
});
export type Skit3DSet = z.infer<typeof setSchema>;

export const actSchema = z.object({
  who: castRef,
  act: z.enum(ACTIONS).optional(),
  face: z.enum(FACES).optional(),
  move: z.enum(MOVES).optional(),
});
export type Act3D = z.infer<typeof actSchema>;

export const lineSchema = z.object({
  speaker: castRef,
  to: castRef.optional(),
  acts: z.array(actSchema).max(SKIT3D_LIMITS.acts).optional(),
  shot: z.enum(SHOTS).optional(),
});
export type Skit3DLine = z.infer<typeof lineSchema>;

export const directionSchema = z.object({
  lines: z.array(
    lineSchema
      .omit({ speaker: true })
      .extend({ line: z.number().int().min(1).max(SKIT3D_LIMITS.lines) }),
  ),
});

export const partSchema = z.object({
  shape: z.enum(SHAPES),
  size: z.tuple([size, size, size]),
  at: z.tuple([unit, unit, unit]),
  turn: z.tuple([unit, unit, unit]).optional(),
  paint: z.enum(PAINT_NAMES),
});
export type ModelPart = z.infer<typeof partSchema>;

export const builtSchema = z.object({
  parts: z.array(partSchema).min(1).max(SKIT3D_LIMITS.parts),
});
export type BuiltModel = z.infer<typeof builtSchema>;

export const riggedSchema = z.object({
  kind: z.literal("rig"),
  url: z.string().url(),
  clips: z.record(z.string(), z.string()),
  faces: z.record(z.string(), z.string()).optional(),
  mouth: z.string().optional(),
  tint: z.string().optional(),
});
export const partsModelSchema = z.object({
  kind: z.literal("parts"),
  parts: builtSchema.shape.parts,
});
export const fileModelSchema = z.object({
  kind: z.literal("file"),
  url: z.string().url(),
  tall: z.number().positive(),
});
export const modelSchema = z.discriminatedUnion("kind", [
  riggedSchema,
  partsModelSchema,
  fileModelSchema,
]);
export type SceneModel = z.infer<typeof modelSchema>;
export type RiggedModel = z.infer<typeof riggedSchema>;
export const modelsSchema = z.record(z.string(), modelSchema);
export type SceneModels = z.infer<typeof modelsSchema>;

export class CastScale {
  static readonly AGE: Record<(typeof AGES)[number], number> = {
    child: 0.62,
    teen: 0.88,
    adult: 1,
    elder: 0.96,
  };
  static readonly HEIGHT: Record<(typeof HEIGHTS)[number], number> = {
    short: 0.92,
    average: 1,
    tall: 1.08,
  };

  static of(member: CastMember3D): number {
    return CastScale.AGE[member.age ?? "adult"] * CastScale.HEIGHT[member.height ?? "average"];
  }
}
