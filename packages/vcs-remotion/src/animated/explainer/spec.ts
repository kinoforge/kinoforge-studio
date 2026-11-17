import { z } from "zod";
import { codePiece, focusPiece } from "./code/spec.ts";
import { broadcastPiece, flowPiece, hidePiece, markPiece, showPiece } from "./diagram/spec.ts";
import { icon, text } from "../shared/fields.ts";
import { mapPiece, pinPiece, routePiece, zonePiece } from "./map/spec.ts";
import {
  crossPiece,
  drivePiece,
  lightPiece,
  lookPiece,
  measurePiece,
  parkPiece,
  roadPiece,
  signPiece,
  signalPiece,
} from "./road/spec.ts";
import { BOARD_COLOR_KEYS, BOARD_GLOWS, BOARD_THEMES, PAINT_NAMES } from "../shared/theme.ts";

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

export const PIECE_LAYERS = ["card", "overlay", "diagram", "code", "road", "map"] as const;
export type PieceLayer = (typeof PIECE_LAYERS)[number];
export const SURFACES = ["diagram", "code", "road", "map"] as const satisfies readonly PieceLayer[];
export type Surface = (typeof SURFACES)[number];

function kind<S extends z.ZodObject>(
  schema: S,
  weight: number,
  example: z.infer<S>,
  layer: PieceLayer = "card",
) {
  return { schema, weight, example, layer };
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
    .array(
      z.object({
        label: text(18),
        value: z.number().min(0),
        color: z.enum(PAINT_NAMES).optional(),
      }),
    )
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
const line = z.object({
  type: z.literal("line"),
  points: z
    .array(z.object({ label: text(10), value: z.number() }))
    .min(2)
    .max(8),
  unit: z.string().max(8).optional(),
});
const pie = z.object({
  type: z.literal("pie"),
  items: z
    .array(z.object({ label: text(18), value: z.number().positive() }))
    .min(2)
    .max(5),
});
const numberline = z.object({
  type: z.literal("numberline"),
  from: z.number(),
  to: z.number(),
  marks: z
    .array(z.object({ at: z.number(), label: text(14).optional() }))
    .min(1)
    .max(4),
});
const chat = z.object({
  type: z.literal("chat"),
  title: text(22).optional(),
  messages: z
    .array(z.object({ from: z.enum(["me", "them"]), text: text(70) }))
    .min(1)
    .max(5),
});
const browser = z.object({
  type: z.literal("browser"),
  url: text(36),
  heading: text(40),
  lines: z.array(text(48)).max(3).optional(),
  button: text(18).optional(),
});

export const PIECE_KINDS = {
  title: kind(title, 0.8, {
    type: "title",
    text: "Why bees matter",
    kicker: "Explained",
  }),
  note: kind(note, 1, {
    type: "note",
    text: "One bee visits up to 5,000 flowers a day.",
  }),
  list: kind(list, 1.4, {
    type: "list",
    style: "check",
    items: ["Pollinate crops", "Make honey", "Feed birds"],
  }),
  steps: kind(steps, 1.1, {
    type: "steps",
    items: ["Flower", "Pollen", "Fruit"],
  }),
  counter: kind(counter, 1, {
    type: "counter",
    to: 80,
    suffix: "%",
    label: "of crops need pollinators",
  }),
  bars: kind(bars, 1.5, {
    type: "bars",
    unit: "kg",
    items: [
      { label: "2000", value: 40 },
      { label: "2010", value: 28 },
      { label: "2020", value: 15 },
    ],
  }),
  compare: kind(compare, 1.5, {
    type: "compare",
    left: { title: "Bees", items: ["Pollinate", "Make honey"] },
    right: { title: "Wasps", items: ["Hunt pests"] },
    winner: "left",
  }),
  terminal: kind(terminal, 1.4, {
    type: "terminal",
    title: "bash",
    lines: ["npm install bees", "bees --pollinate"],
  }),
  quote: kind(quote, 1.1, {
    type: "quote",
    text: "If the bee disappeared, man would have only four years left.",
    by: "Often misattributed",
  }),
  stamp: kind(stamp, 0, { type: "stamp", text: "MYTH", tone: "bad" }, "overlay"),
  icons: kind(icons, 1, {
    type: "icons",
    items: [
      { icon: "leaf", label: "Plants" },
      { icon: "users", label: "People" },
    ],
  }),
  progress: kind(progress, 0.8, {
    type: "progress",
    value: 35,
    label: "colonies lost each winter",
  }),
  timeline: kind(timeline, 1.5, {
    type: "timeline",
    items: [
      { when: "1900", text: "Wild hives everywhere" },
      { when: "2006", text: "Colony collapse noticed" },
    ],
  }),
  formula: kind(formula, 0.9, {
    type: "formula",
    text: "flowers + bees = fruit",
  }),
  line: kind(line, 1.5, {
    type: "line",
    unit: "°C",
    points: [
      { label: "1900", value: 13.7 },
      { label: "1950", value: 13.9 },
      { label: "2000", value: 14.4 },
      { label: "2020", value: 14.9 },
    ],
  }),
  pie: kind(pie, 1.5, {
    type: "pie",
    items: [
      { label: "Rent", value: 40 },
      { label: "Food", value: 25 },
      { label: "Savings", value: 35 },
    ],
  }),
  numberline: kind(numberline, 1, {
    type: "numberline",
    from: -5,
    to: 5,
    marks: [
      { at: -3, label: "-3" },
      { at: 2, label: "2" },
    ],
  }),
  chat: kind(chat, 2, {
    type: "chat",
    title: "Bank",
    messages: [
      { from: "them", text: "Your account is locked. Tap the link to verify." },
      { from: "me", text: "Who is this?" },
    ],
  }),
  browser: kind(browser, 1.8, {
    type: "browser",
    url: "shop.example.com",
    heading: "Free shipping today",
    lines: ["Order before 6 pm"],
    button: "Buy now",
  }),
  sign: kind(signPiece, 1.2, {
    type: "sign",
    kind: "give-way",
    label: "Give way to traffic on the ring",
  }),
  show: kind(
    showPiece,
    0,
    {
      type: "show",
      nodes: ["client", "balancer"],
      links: [{ from: "client", to: "balancer", label: "HTTPS" }],
    },
    "diagram",
  ),
  flow: kind(
    flowPiece,
    0,
    { type: "flow", path: ["client", "balancer", "server-1"], label: "GET /" },
    "diagram",
  ),
  broadcast: kind(
    broadcastPiece,
    0,
    { type: "broadcast", from: "subject", to: ["phone", "website"], label: "update" },
    "diagram",
  ),
  mark: kind(
    markPiece,
    0,
    { type: "mark", nodes: ["server-2"], tone: "bad", label: "down" },
    "diagram",
  ),
  hide: kind(
    hidePiece,
    0,
    { type: "hide", links: [{ from: "client", to: "server-1" }] },
    "diagram",
  ),
  code: kind(codePiece, 0, { type: "code", file: "subject", through: "attach(observer" }, "code"),
  focus: kind(
    focusPiece,
    0,
    { type: "focus", lines: ["for (const o of this.observers)"], label: "tell them all" },
    "code",
  ),
  road: kind(roadPiece, 0, { type: "road", layout: "roundabout" }, "road"),
  drive: kind(drivePiece, 0, { type: "drive", car: "you", to: "right" }, "road"),
  signal: kind(signalPiece, 0, { type: "signal", car: "you", side: "right" }, "road"),
  look: kind(lookPiece, 0, { type: "look", toward: "left", label: "traffic first" }, "road"),
  measure: kind(
    measurePiece,
    0,
    {
      type: "measure",
      parts: [
        { label: "Thinking", value: 14 },
        { label: "Braking", value: 14 },
      ],
      unit: "m",
    },
    "road",
  ),
  cross: kind(crossPiece, 0, { type: "cross", at: "right" }, "road"),
  light: kind(lightPiece, 0, { type: "light", state: "red" }, "road"),
  park: kind(parkPiece, 0, { type: "park" }, "road"),
  map: kind(mapPiece, 0, { type: "map", region: "europe" }, "map"),
  pin: kind(pinPiece, 0, { type: "pin", places: ["rome", "paris"] }, "map"),
  route: kind(
    routePiece,
    0,
    { type: "route", from: "lisbon", to: "calicut", via: ["cape"], mode: "ship", label: "1498" },
    "map",
  ),
  zone: kind(
    zonePiece,
    0,
    { type: "zone", countries: ["FRA", "DEU", "ITA"], tone: "good", label: "founders" },
    "map",
  ),
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
  line,
  pie,
  numberline,
  chat,
  browser,
  signPiece,
  showPiece,
  flowPiece,
  broadcastPiece,
  markPiece,
  hidePiece,
  codePiece,
  focusPiece,
  roadPiece,
  drivePiece,
  signalPiece,
  lookPiece,
  measurePiece,
  crossPiece,
  lightPiece,
  parkPiece,
  mapPiece,
  pinPiece,
  routePiece,
  zonePiece,
]);
export type Piece = z.infer<typeof pieceSchema>;
export type PieceOf<T extends PieceType> = Extract<Piece, { type: T }>;

export const beatSchema = z.object({
  cue: text(40),
  piece: pieceSchema,
  clear: z.boolean().optional(),
});
export type Beat = z.infer<typeof beatSchema>;

export const boardSchema = z.object({
  mood: z.enum(MOODS),
  beats: z.array(beatSchema).min(1).max(8),
});
export type Board = z.infer<typeof boardSchema>;

export const mascotSchema = z.object({ rig: z.enum(MASCOT_RIGS), hat: z.enum(MASCOT_HATS) });
export type Mascot = z.infer<typeof mascotSchema>;

export const boardThemeSchema = z.enum(BOARD_THEMES);
export const boardColorsSchema = z.partialRecord(
  z.enum(BOARD_COLOR_KEYS),
  z.string().regex(/^#[0-9a-fA-F]{6}$/),
);
export const boardGlowSchema = z.enum(BOARD_GLOWS);
