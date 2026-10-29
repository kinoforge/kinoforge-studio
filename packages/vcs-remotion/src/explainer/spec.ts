import { z } from "zod";
import { BOARD_ICON_KEYS } from "./icons.ts";
import { BOARD_THEMES } from "./theme.ts";

export const MOODS = ["happy", "thinking", "surprised", "sad", "excited"] as const;
export const MASCOT_RIGS = ["pip", "bolt"] as const;
export const MASCOT_HATS = [
  "none",
  "cap",
  "grad",
  "hardhat",
  "wizard",
  "crown",
  "beanie",
  "headset",
] as const;
export const LIST_STYLES = ["check", "bullet", "number", "cross"] as const;
export const STAMP_TONES = ["good", "bad", "warn"] as const;
export const CAPTION_RESERVES = ["bottom", "top", "none"] as const;

export type Mood = (typeof MOODS)[number];
export type MascotRig = (typeof MASCOT_RIGS)[number];
export type MascotHat = (typeof MASCOT_HATS)[number];
export type CaptionReserve = (typeof CAPTION_RESERVES)[number];

const text = (max: number) => z.string().trim().min(1).max(max);
const icon = z.enum(BOARD_ICON_KEYS).describe("a key from ICONS");

function kind<S extends z.ZodObject>(
  schema: S,
  weight: number,
  about: string,
  example: z.infer<S>,
) {
  return { schema, weight, about, example };
}

const title = z.object({ type: z.literal("title"), text: text(48), kicker: text(28).optional() });
const note = z.object({ type: z.literal("note"), text: text(140) });
const list = z.object({
  type: z.literal("list"),
  style: z.enum(LIST_STYLES),
  items: z.array(text(44)).min(2).max(5),
});
const steps = z.object({ type: z.literal("steps"), items: z.array(text(24)).min(2).max(4) });
const counter = z.object({
  type: z.literal("counter"),
  to: z.number(),
  from: z.number().optional(),
  decimals: z.int().min(0).max(2).optional(),
  prefix: z.string().max(4).optional(),
  suffix: z.string().max(8).optional(),
  label: text(40),
});
const bars = z.object({
  type: z.literal("bars"),
  items: z
    .array(z.object({ label: text(18), value: z.number().min(0) }))
    .min(2)
    .max(6),
  unit: z.string().max(8).optional(),
});
const side = z.object({ title: text(20), items: z.array(text(28)).min(1).max(4) });
const compare = z.object({
  type: z.literal("compare"),
  left: side,
  right: side,
  winner: z.enum(["left", "right"]).optional(),
});
const terminal = z.object({
  type: z.literal("terminal"),
  title: text(24).optional(),
  lines: z.array(text(48)).min(1).max(6),
});
const quote = z.object({ type: z.literal("quote"), text: text(140), by: text(32).optional() });
const stamp = z.object({ type: z.literal("stamp"), text: text(16), tone: z.enum(STAMP_TONES) });
const icons = z.object({
  type: z.literal("icons"),
  items: z
    .array(z.object({ icon, label: text(16) }))
    .min(1)
    .max(4),
});
const progress = z.object({
  type: z.literal("progress"),
  value: z.number().min(0).max(100),
  label: text(40),
});
const timeline = z.object({
  type: z.literal("timeline"),
  items: z
    .array(z.object({ when: text(12), text: text(36) }))
    .min(2)
    .max(5),
});
const formula = z.object({ type: z.literal("formula"), text: text(40) });

/** Every piece a board can show: its schema, its share of the board's height, what it is
 *  for (told to the writer) and an example. Adding a piece here adds it to the writer's
 *  catalog, the validator and the JSON schema at once; its view goes in pieces.tsx. */
export const PIECE_KINDS = {
  title: kind(title, 0.8, "A big headline that opens a topic.", {
    type: "title",
    text: "Why bees matter",
    kicker: "Explained",
  }),
  note: kind(note, 1, "One sentence on a card: a key point, a definition, a tip.", {
    type: "note",
    text: "One bee visits up to 5,000 flowers a day.",
  }),
  list: kind(list, 1.4, "Short items ticked in one by one. style: check, bullet, number, cross.", {
    type: "list",
    style: "check",
    items: ["Pollinate crops", "Make honey", "Feed birds"],
  }),
  steps: kind(steps, 1.1, "A process, left to right with arrows.", {
    type: "steps",
    items: ["Flower", "Pollen", "Fruit"],
  }),
  counter: kind(counter, 1, "A number that counts up to its value.", {
    type: "counter",
    to: 80,
    suffix: "%",
    label: "of crops need pollinators",
  }),
  bars: kind(bars, 1.5, "A bar chart that grows.", {
    type: "bars",
    unit: "kg",
    items: [
      { label: "2000", value: 40 },
      { label: "2010", value: 28 },
      { label: "2020", value: 15 },
    ],
  }),
  compare: kind(compare, 1.5, "Two sides against each other; winner marks the better one.", {
    type: "compare",
    left: { title: "Bees", items: ["Pollinate", "Make honey"] },
    right: { title: "Wasps", items: ["Hunt pests"] },
    winner: "left",
  }),
  terminal: kind(terminal, 1.4, "A terminal window typing lines of code or commands.", {
    type: "terminal",
    title: "bash",
    lines: ["npm install bees", "bees --pollinate"],
  }),
  quote: kind(quote, 1.1, "A quotation with who said it.", {
    type: "quote",
    text: "If the bee disappeared, man would have only four years left.",
    by: "Often misattributed",
  }),
  stamp: kind(stamp, 0, "A rubber stamp slammed over the board: a verdict.", {
    type: "stamp",
    text: "MYTH",
    tone: "bad",
  }),
  icons: kind(icons, 1, "A row of icons with labels. icon must be a key from ICONS.", {
    type: "icons",
    items: [
      { icon: "leaf", label: "Plants" },
      { icon: "users", label: "People" },
    ],
  }),
  progress: kind(progress, 0.8, "A bar filling to a percent.", {
    type: "progress",
    value: 35,
    label: "colonies lost each winter",
  }),
  timeline: kind(timeline, 1.5, "Dated events in order.", {
    type: "timeline",
    items: [
      { when: "1900", text: "Wild hives everywhere" },
      { when: "2006", text: "Colony collapse noticed" },
    ],
  }),
  formula: kind(formula, 0.9, "An equation or rule in large type.", {
    type: "formula",
    text: "flowers + bees = fruit",
  }),
} as const;

export type PieceType = keyof typeof PIECE_KINDS;

export const pieceSchema = z.discriminatedUnion("type", [
  title,
  note,
  list,
  steps,
  counter,
  bars,
  compare,
  terminal,
  quote,
  stamp,
  icons,
  progress,
  timeline,
  formula,
]);
export type Piece = z.infer<typeof pieceSchema>;
export type PieceOf<T extends PieceType> = Extract<Piece, { type: T }>;

export const beatSchema = z.object({
  cue: text(40).describe("words of the narration, copied exactly, where this piece appears"),
  piece: pieceSchema,
  clear: z.boolean().optional().describe("true wipes the pieces shown before this one"),
});
export type Beat = z.infer<typeof beatSchema>;

export const boardSchema = z.object({
  mood: z.enum(MOODS),
  beats: z.array(beatSchema).min(1).max(6),
});
export type Board = z.infer<typeof boardSchema>;

export const mascotSchema = z.object({ rig: z.enum(MASCOT_RIGS), hat: z.enum(MASCOT_HATS) });
export type Mascot = z.infer<typeof mascotSchema>;

export const boardThemeSchema = z.enum(BOARD_THEMES);
