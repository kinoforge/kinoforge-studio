import { z } from "zod";
import { STAGE_REF, picture, slug, text } from "../explainer/fields.ts";
import { PAINT_NAMES } from "../explainer/theme.ts";

export const SKIT_LIMITS = {
  cast: 4,
  name: 24,
  role: 18,
  props: 6,
  title: 40,
  tags: 10,
  tag: 26,
  fields: 4,
  label: 14,
  value: 14,
  unit: 8,
  badges: 3,
  badge: 16,
  acts: 4,
  changes: 4,
  cue: 40,
  lines: 80,
} as const;

export const PLACES = ["far_left", "left", "center", "right", "far_right"] as const;
export const STANCES = ["stand", "sit"] as const;
export const WEARS = [
  "tee",
  "hoodie",
  "shirt_tie",
  "suit",
  "dress",
  "lab_coat",
  "jacket",
  "sweater",
  "apron",
  "uniform",
  "robe",
  "scrubs",
] as const;
export const HAIRS = ["none", "short", "long", "bun", "curly", "spiky", "ponytail", "afro", "mohawk"] as const;
export const HAIR_COLOURS = ["black", "brown", "blonde", "red", "grey", "white"] as const;
export const SKINS = ["light", "fair", "tan", "brown", "dark"] as const;
export const HATS = [
  "cap",
  "beanie",
  "top_hat",
  "chef",
  "hard_hat",
  "crown",
  "wizard",
  "cowboy",
  "grad",
  "helmet",
] as const;
export const FACES = ["plain", "glasses", "beard", "moustache", "shades"] as const;
export const DESKS = ["none", "laptop", "monitor", "papers"] as const;
export const HOLDS = ["phone", "coffee", "tablet", "book", "pointer", "microphone"] as const;
export const VOICE_KINDS = ["female", "male"] as const;
export const SET_PROPS = ["whiteboard", "server", "plant", "door", "window", "clock"] as const;
export const BACKDROPS = [
  "plain",
  "office",
  "classroom",
  "kitchen",
  "home",
  "street",
  "park",
  "lab",
  "shop",
  "stage",
  "space",
] as const;
export const CARD_KINDS = ["ticket", "checklist", "score"] as const;
export const DRAWS = ["beside", "full"] as const;
export const POSES = [
  "idle",
  "talk",
  "point",
  "arms_up",
  "shrug",
  "facepalm",
  "hands_on_head",
  "lean_back",
  "type",
  "think",
  "cross_arms",
  "wave",
  "cheer",
  "slump",
  "present",
] as const;
export const EXPRESSIONS = [
  "neutral",
  "happy",
  "angry",
  "sad",
  "surprised",
  "smug",
  "tired",
  "worried",
] as const;
export const REACTIONS = [
  "question",
  "exclaim",
  "sweat",
  "stress",
  "fire",
  "idea",
  "sparkle",
  "zzz",
] as const;
export const CHANGE_KINDS = ["tag", "untag", "set", "badge", "unbadge", "title"] as const;
export const OFF = "off";
export const MOVES = [...PLACES, OFF] as const;

export type Place = (typeof PLACES)[number];
export type Stance = (typeof STANCES)[number];
export type Wear = (typeof WEARS)[number];
export type Hair = (typeof HAIRS)[number];
export type HairColour = (typeof HAIR_COLOURS)[number];
export type Skin = (typeof SKINS)[number];
export type Hat = (typeof HATS)[number];
export type FaceLook = (typeof FACES)[number];
export type Desk = (typeof DESKS)[number];
export type Hold = (typeof HOLDS)[number];
export type SetProp = (typeof SET_PROPS)[number];
export type Backdrop = (typeof BACKDROPS)[number];
export type Draw = (typeof DRAWS)[number];
export type CardKind = (typeof CARD_KINDS)[number];
export type Pose = (typeof POSES)[number];
export type Expression = (typeof EXPRESSIONS)[number];
export type Reaction = (typeof REACTIONS)[number];
export type Move = (typeof MOVES)[number];

const castRef = slug.describe("a cast id from the SET").meta({ [STAGE_REF]: "cast" });
const fieldRef = slug.describe("a field id from the SET").meta({ [STAGE_REF]: "fields" });

export const castSchema = z.object({
  id: slug,
  name: text(SKIT_LIMITS.name).describe("the character's name exactly as the script names them"),
  role: text(SKIT_LIMITS.role).describe("the label on their speech bubble"),
  voice: z.enum(VOICE_KINDS),
  wear: z.enum(WEARS).optional(),
  hair: z.enum(HAIRS).optional(),
  hair_colour: z.enum(HAIR_COLOURS).optional(),
  skin: z.enum(SKINS).optional(),
  face: z.enum(FACES).optional(),
  hat: picture.optional().describe("one of HATS, or plain words naming any hat"),
  head: picture.optional().describe("plain words naming a drawn head that replaces the face"),
  colour: z.enum(PAINT_NAMES),
  place: z.enum(PLACES),
  stance: z.enum(STANCES),
  desk: z.enum(DESKS).optional(),
  holds: picture.optional().describe("one of HOLDS, or plain words naming any thing in hand"),
  enters: z.boolean().optional().describe("true starts them off the set until a line moves them on"),
});
export type CastMember = z.infer<typeof castSchema>;

export const fieldSchema = z.object({
  id: slug,
  label: text(SKIT_LIMITS.label),
  value: z.union([z.number(), text(SKIT_LIMITS.value)]),
  unit: text(SKIT_LIMITS.unit).optional(),
});
export type CardField = z.infer<typeof fieldSchema>;

export const cardSchema = z.object({
  kind: z.enum(CARD_KINDS),
  title: text(SKIT_LIMITS.title),
  icon: picture.optional(),
  tags: z.array(text(SKIT_LIMITS.tag)).max(SKIT_LIMITS.tags).optional(),
  badges: z.array(text(SKIT_LIMITS.badge)).max(SKIT_LIMITS.badges).optional(),
});
export type RunningCard = z.infer<typeof cardSchema>;

export const propSchema = z.object({
  kind: picture.describe("one of SET_PROPS, or plain words naming any thing on the set"),
  place: z.enum(PLACES),
});
export type SetPropPick = z.infer<typeof propSchema>;

export const setSchema = z.object({
  backdrop: z.enum(BACKDROPS).optional(),
  cast: z.array(castSchema).min(1).max(SKIT_LIMITS.cast),
  props: z
    .array(propSchema)
    .max(SKIT_LIMITS.props)
    .optional(),
  card: cardSchema.optional(),
  fields: z.array(fieldSchema).max(SKIT_LIMITS.fields).optional(),
});
export type SkitSet = z.infer<typeof setSchema>;

export const actSchema = z.object({
  who: castRef,
  pose: z.enum(POSES).optional(),
  face: z.enum(EXPRESSIONS).optional(),
  react: z.enum(REACTIONS).optional(),
  move: z.enum(MOVES).optional(),
});
export type Act = z.infer<typeof actSchema>;

const cue = text(SKIT_LIMITS.cue)
  .describe("words of the line, copied exactly, where the change happens")
  .optional();

export const changeSchema = z.discriminatedUnion("do", [
  z.object({ do: z.literal("tag"), text: text(SKIT_LIMITS.tag), cue }),
  z.object({ do: z.literal("untag"), text: text(SKIT_LIMITS.tag), cue }),
  z.object({
    do: z.literal("set"),
    field: fieldRef,
    value: z.union([z.number(), text(SKIT_LIMITS.value)]),
    cue,
  }),
  z.object({ do: z.literal("badge"), text: text(SKIT_LIMITS.badge), cue }),
  z.object({ do: z.literal("unbadge"), text: text(SKIT_LIMITS.badge), cue }),
  z.object({ do: z.literal("title"), text: text(SKIT_LIMITS.title), cue }),
]);
export type CardChange = z.infer<typeof changeSchema>;

export const lineSchema = z.object({
  speaker: castRef,
  to: castRef.optional().describe("who the speaker talks to; left out, the viewer"),
  acts: z.array(actSchema).max(SKIT_LIMITS.acts).optional(),
  card: z.array(changeSchema).max(SKIT_LIMITS.changes).optional(),
  draw: z.enum(DRAWS).optional(),
});
export type SkitLine = z.infer<typeof lineSchema>;

export const directionSchema = z.object({
  lines: z.array(lineSchema.omit({ speaker: true }).extend({ line: z.number().int().min(1).max(SKIT_LIMITS.lines) })),
});
