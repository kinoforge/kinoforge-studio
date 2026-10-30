import { z } from "zod";
import { codePiece, focusPiece } from "./code/spec.ts";
import { broadcastPiece, flowPiece, hidePiece, markPiece, showPiece } from "./diagram/spec.ts";
import { icon, text } from "./fields.ts";
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

/** Where a piece is drawn: a card stacked on the board, laid over it, on the diagram, in the
 *  code editor, on the road or on the map. */
export const PIECE_LAYERS = ["card", "overlay", "diagram", "code", "road", "map"] as const;
export type PieceLayer = (typeof PIECE_LAYERS)[number];
/** The layers a board draws on whole, at most one per board, carried from scene to scene. */
export const SURFACES = ["diagram", "code", "road", "map"] as const satisfies readonly PieceLayer[];
export type Surface = (typeof SURFACES)[number];

function kind<S extends z.ZodObject>(
  schema: S,
  weight: number,
  about: string,
  example: z.infer<S>,
  layer: PieceLayer = "card",
) {
  return { schema, weight, about, example, layer };
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
  terminal: kind(terminal, 1.4, "A terminal window typing shell commands.", {
    type: "terminal",
    title: "bash",
    lines: ["npm install bees", "bees --pollinate"],
  }),
  quote: kind(quote, 1.1, "A quotation with who said it.", {
    type: "quote",
    text: "If the bee disappeared, man would have only four years left.",
    by: "Often misattributed",
  }),
  stamp: kind(
    stamp,
    0,
    "A rubber stamp slammed over the board: a verdict.",
    { type: "stamp", text: "MYTH", tone: "bad" },
    "overlay",
  ),
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
  line: kind(line, 1.5, "A line chart that draws itself: a trend over time.", {
    type: "line",
    unit: "°C",
    points: [
      { label: "1900", value: 13.7 },
      { label: "1950", value: 13.9 },
      { label: "2000", value: 14.4 },
      { label: "2020", value: 14.9 },
    ],
  }),
  pie: kind(pie, 1.5, "A donut of shares of a whole, with their percentages.", {
    type: "pie",
    items: [
      { label: "Rent", value: 40 },
      { label: "Food", value: 25 },
      { label: "Savings", value: 35 },
    ],
  }),
  numberline: kind(
    numberline,
    1,
    "A number line from `from` to `to` with marks dropped on it: fractions, negatives, a range.",
    {
      type: "numberline",
      from: -5,
      to: 5,
      marks: [
        { at: -3, label: "-3" },
        { at: 2, label: "2" },
      ],
    },
  ),
  chat: kind(
    chat,
    2,
    "A messaging app: bubbles popping in, the person's own (me) on the right. A conversation, a scam text, a support chat.",
    {
      type: "chat",
      title: "Bank",
      messages: [
        { from: "them", text: "Your account is locked. Tap the link to verify." },
        { from: "me", text: "Who is this?" },
      ],
    },
  ),
  browser: kind(
    browser,
    1.8,
    "A browser window: the address types in, then the page's heading, a few lines and a button. A website, a sign-up, a search.",
    {
      type: "browser",
      url: "shop.example.com",
      heading: "Free shipping today",
      lines: ["Order before 6 pm"],
      button: "Buy now",
    },
  ),
  sign: kind(
    signPiece,
    1.2,
    "A road sign the narration names, with what it means beside it. value is the number on a speed-limit sign.",
    { type: "sign", kind: "give-way", label: "Give way to traffic on the ring" },
  ),
  show: kind(
    showPiece,
    0,
    "Nodes pop onto the diagram, then arrows draw between them.",
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
    "A packet travels node to node along a path: a request, an event, data.",
    { type: "flow", path: ["client", "balancer", "server-1"], label: "GET /" },
    "diagram",
  ),
  broadcast: kind(
    broadcastPiece,
    0,
    "Packets fan out from one node to many at once.",
    { type: "broadcast", from: "subject", to: ["phone", "website"], label: "update" },
    "diagram",
  ),
  mark: kind(
    markPiece,
    0,
    "Rings nodes with a tone and an optional badge: focus, good, bad (down, wrong), warn.",
    { type: "mark", nodes: ["server-2"], tone: "bad", label: "down" },
    "diagram",
  ),
  hide: kind(
    hidePiece,
    0,
    "Takes nodes (with their arrows) or arrows off the diagram; all: true empties it.",
    { type: "hide", links: [{ from: "client", to: "server-1" }] },
    "diagram",
  ),
  code: kind(
    codePiece,
    0,
    "Opens a STAGE file and types it in, down to the line holding `through` (all of it without); a later code beat on the same file types on from there.",
    { type: "code", file: "subject", through: "attach(observer" },
    "code",
  ),
  focus: kind(
    focusPiece,
    0,
    "Lights the lines of the open file that hold each text and dims the rest, with an optional badge: focus, good, bad (a bug, a smell), warn.",
    { type: "focus", lines: ["for (const o of this.observers)"], label: "tell them all" },
    "code",
  ),
  road: kind(
    roadPiece,
    0,
    "Sets the road the scene happens on, seen from above: straight (lanes: per direction), motorway (lanes: 2 or 3, with a slip road joining from the kerb side), crossroads, junction (a T: left and right only), roundabout or car-park (bays both sides of an aisle). A new layout clears the cars.",
    { type: "road", layout: "roundabout" },
    "road",
  ),
  drive: kind(
    drivePiece,
    0,
    "A car drives in from an arm (from: back unless said) and waits at its give-way line (to: stop), or drives through and out by an arm (to: left, ahead, right, back). A car already waiting starts from there. On a straight road stop holds a car in view as the road runs on, you low and the others ahead of you, so a car in front is driven to stop too; lane picks its lane.",
    { type: "drive", car: "you", to: "right" },
    "road",
  ),
  signal: kind(
    signalPiece,
    0,
    "A car's indicator blinks on that side until it leaves; off stops it.",
    { type: "signal", car: "you", side: "right" },
    "road",
  ),
  look: kind(
    lookPiece,
    0,
    "Where the driver looks, as a beam from the car (you unless said): behind is the mirrors, a shoulder the blind spot on that side.",
    { type: "look", toward: "left", label: "traffic first" },
    "road",
  ),
  measure: kind(
    measurePiece,
    0,
    "A distance laid on the road ahead of a car (you unless said), in parts to scale: thinking then braking distance, the gap to the car in front.",
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
  cross: kind(
    crossPiece,
    0,
    "Someone walks over a crossing on that arm of the road.",
    { type: "cross", at: "right" },
    "road",
  ),
  light: kind(
    lightPiece,
    0,
    "A traffic light at an arm's stop line (back unless said) turns red, amber or green; cars wait at the line while it is red. At a crossroads, a junction or a roundabout.",
    { type: "light", state: "red" },
    "road",
  ),
  park: kind(
    parkPiece,
    0,
    "Parks a car (you unless said): in a car park it drives past the free bay and reverses in; on a straight road it reverses into the gap between two parked cars at the kerb. A later drive pulls it out.",
    { type: "park" },
    "road",
  ),
  map: kind(
    mapPiece,
    0,
    "Moves the map to a region. Without it the map fits the places and countries on it.",
    { type: "map", region: "europe" },
    "map",
  ),
  pin: kind(
    pinPiece,
    0,
    "Drops pins on STAGE places, with their names.",
    { type: "pin", places: ["rome", "paris"] },
    "map",
  ),
  route: kind(
    routePiece,
    0,
    "A route drawn from one STAGE place to another, with a plane, ship or car travelling it (plane unless said); via lists the STAGE places it passes, so a ship sails round a cape instead of over land.",
    { type: "route", from: "lisbon", to: "calicut", via: ["cape"], mode: "ship", label: "1498" },
    "map",
  ),
  zone: kind(
    zonePiece,
    0,
    "Fills countries with a tone (focus unless said) and an optional label: an empire, an alliance, where something happens.",
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
  cue: text(40).describe("words of the narration, copied exactly, where this piece appears"),
  piece: pieceSchema,
  clear: z.boolean().optional().describe("true wipes the pieces shown before this one"),
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
