import { z } from "zod";
import { STAGE_REF } from "../explainer/fields.ts";
import { Signature } from "../explainer/kit.ts";
import { CAPTION_RESERVES } from "../explainer/spec.ts";
import { BOARD_COLOR_KEYS, BOARD_GLOWS, BoardThemes } from "../explainer/theme.ts";
import { SKIT_COMPOSITION_ID } from "./composition.tsx";
import {
  BACKDROPS,
  CARD_KINDS,
  DRAWS,
  EXPRESSIONS,
  HATS,
  HOLDS,
  POSES,
  PRESENTERS,
  type Pose,
  REACTIONS,
  type Reaction,
  SET_PROPS,
  SKIT_LIMITS,
  VOICE_KINDS,
  changeSchema,
  directionSchema,
  setSchema,
} from "./spec.ts";

type JsonSchema = Parameters<typeof Signature.of>[0];

const POSE_ABOUT: Record<Pose, string> = {
  idle: "standing or sitting easy",
  talk: "talking with one hand",
  point: "pointing at who they talk to",
  arms_up: "both arms up: outraged or begging",
  shrug: "palms up: no idea, whatever",
  facepalm: "hand on face: disbelief",
  hands_on_head: "both hands on head: panic",
  lean_back: "leaning back, hands behind head: relaxed, smug",
  type: "typing at their desk",
  think: "hand on chin: thinking",
  cross_arms: "arms crossed: not convinced",
  wave: "waving hello or bye",
  cheer: "both arms up, hopping: winning",
  slump: "slumped: defeated, tired",
  present: "an open hand up to the drawn board: showing, explaining",
};

const REACTION_ABOUT: Record<Reaction, string> = {
  question: "a ? over the head: confused",
  exclaim: "a ! over the head: shocked",
  sweat: "a sweat drop: nervous",
  stress: "an anger mark: annoyed",
  fire: "flames on the head: furious or burning out",
  idea: "a light bulb: an idea",
  sparkle: "sparkles: proud, delighted",
  zzz: "z z z: bored",
};

export class SkitKit {
  static readonly VERSION = 4;

  static setCatalog(): string {
    const fields = (SkitKit.json(setSchema).properties ?? {}) as Record<string, JsonSchema>;
    const cast = fields.cast?.items ?? {};
    return [
      `SET: {"backdrop"?: ${BACKDROPS.join("|")}, "cast": 1 to ${SKIT_LIMITS.cast} of ${Signature.of(cast)}, "props"?: ${Signature.of(fields.props ?? {})}, "card"?: ${Signature.of(fields.card ?? {})}, "fields"?: ${Signature.of(fields.fields ?? {})}}`,
      "backdrop: the script's own place; the nearest kind only when none is it; plain when it names no place.",
      "cast: everyone who speaks in the script, named exactly as the script names them, with a short kebab-case id. role is the label on their speech bubble: their job or part in the story (Teacher, Mom, Chef, Product manager). One presenter alone is a cast of one.",
      `voice: ${VOICE_KINDS.join("|")}, as the character would sound.`,
      "Looks: give each person a look that fits who they are (wear, hair, hat, face, skin, colour), different enough to tell apart. head: plain words for a drawn head instead of a face (a robot, a cat), only for someone who is not a person.",
      `HATS: ${HATS.join("|")}. HOLDS: ${HOLDS.join("|")}. SET_PROPS: ${SET_PROPS.join("|")}. Anything else is plain words naming the thing, drawn from the picture library.`,
      "place: where they stand, left to right. Two people talking face each other from left and right; a third goes in the center; a presenter alone stands center.",
      "stance: stand, or sit for someone working at a desk; give them a desk (laptop or monitor makes them type while others talk).",
      "holds: the one thing the script puts in their hand, in plain words when it is not in HOLDS (a toothbrush, a spoon); never another thing standing in for it, and none when their hands are free.",
      `card: one card at the top that the whole video keeps changing, as the first line finds it: ${CARD_KINDS.join("|")} (a ticket's title is the task, a checklist's the plan, a score's what is counted). tags are what it lists before the first line: only what the viewer may already know (a plan's steps). A list the script builds as it goes (excuses, demands, mistakes) starts with no tags and its lines add them. icon: plain words for its picture. Leave the card out unless the script truly keeps count of something; a plain talk needs no card.`,
      "fields: the card's few numbers or short values (points 1, due today), with ids the lines change them by.",
      "props: things standing on the set (furniture, machines), only when the script's place has them; a small thing someone uses goes in their hand instead.",
    ].join("\n");
  }

  static directionCatalog(): string {
    const fields = (SkitKit.json(directionSchema).properties ?? {}) as Record<string, JsonSchema>;
    const line = fields.lines?.items ?? {};
    const list = <T extends string>(about: Record<T, string>) =>
      Object.entries(about)
        .map(([key, text]) => `${key} (${text})`)
        .join(", ");
    return [
      `LINES: {"lines": [${Signature.of(line).replace(`of ${Signature.of({})}`, "of CHANGES")}]}, one entry per line of the script, in order, line counted from 1.`,
      "to: the cast id the speaker talks to; left out, they talk to the viewer.",
      "acts: how the cast moves on this line, at most one entry per person. Give the speaker a pose that plays what they say; left out, they simply talk. Give listeners a face that shows what they feel hearing it. At most one react on a line, on whoever feels it most; the others simply listen. A pose holds until a later line changes it; a speaker given no pose goes back to rest after the line.",
      `POSES: ${list(POSE_ABOUT)}.`,
      `FACES: ${EXPRESSIONS.join("|")}; left out, the pose's own.`,
      `REACTIONS: ${list(REACTION_ABOUT)}.`,
      `CHANGES: ${SkitKit.changes().join(" | ")}`,
      "move: walk to a place, or off to leave the set. Someone who enters starts off the set until a line moves them on.",
      "card: what this line changes on the card, in the order it says it: tag adds a tag (a new demand, a new task, a new excuse) when the line first names it, tick ticks a checklist item as done or beaten, untag drops one that no longer belongs, set gives a field its new value, badge stamps a short badge (DUE TODAY) for this line only, title renames the card. cue: words of the line, copied exactly, where it happens. Change the card only when the line truly changes it.",
      `draw: ${DRAWS.join("|")}, for a line that explains something better drawn (how a thing works, a flow, numbers). beside keeps the cast in view and the speaker presents a board drawn next to them; full cuts away to the board, the speaker small below. Use it only as often as the brief allows, never on the first line.`,
      "beat: true holds a short pause after this line: after a setup so its punchline lands, or after the big laugh. Only on those lines.",
    ].join("\n");
  }

  static storyCatalog(): string {
    return [
      "This video is a dialogue: each scene is one line said by one of the characters. Set speaker to their name, narration to exactly what they say, and prompt to what they do.",
      "It is played by drawn stick figure people on one flat set seen from the front, like a puppet show. There is no camera: no close ups, angles, cuts or reflections, and no hands doing fine work.",
      `The set is one of: ${BACKDROPS.join(", ")}. Each person stands or sits in one place, walks to another place or off the set, holds one thing in their hand, and plays each line with one pose, one face and one mark over the head.`,
      `Poses: ${POSES.join(", ")}. Faces: ${EXPRESSIONS.join(", ")}. Marks: ${REACTIONS.join(", ")}.`,
      "A card at the top can keep a running list, a checklist or a score, and a line may show a drawn board that explains something.",
      "So each scene prompt is one short stage direction the set can play: who takes which pose with what face, holding what. The jokes live in the words; the set only backs them up.",
    ].join("\n");
  }

  static changes(): string[] {
    return changeSchema.options.map((option) => {
      const kind = option.shape.do.value;
      const rest = Signature.fields(SkitKit.json(option)).filter(
        (field) => !field.startsWith("do"),
      );
      return `{do: ${kind}, ${rest.join(", ")}}`;
    });
  }

  static json(schema: z.ZodType): JsonSchema & Record<string, unknown> {
    return z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" }) as JsonSchema &
      Record<string, unknown>;
  }

  static describe() {
    return {
      version: SkitKit.VERSION,
      composition: SKIT_COMPOSITION_ID,
      reserves: CAPTION_RESERVES,
      ref: STAGE_REF,
      limits: SKIT_LIMITS,
      poses: POSES,
      reactions: REACTIONS,
      voices: VOICE_KINDS,
      backdrops: BACKDROPS,
      draws: DRAWS,
      presenters: PRESENTERS,
      pictures: { hat: HATS, head: [], holds: HOLDS, kind: SET_PROPS, icon: [] },
      colors: BOARD_COLOR_KEYS,
      glows: BOARD_GLOWS,
      story: { catalog: SkitKit.storyCatalog() },
      set: { schema: SkitKit.json(setSchema), catalog: SkitKit.setCatalog() },
      direction: { schema: SkitKit.json(directionSchema), catalog: SkitKit.directionCatalog() },
      assets: BoardThemes.swatches(),
    };
  }
}
