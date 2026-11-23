import { z } from "zod";
import { picture, slug, text } from "../shared/fields.ts";
import { elementsSchema } from "../shared/elements/spec.ts";

export const WB_THEMES = ["whiteboard", "chalkboard"] as const;
export const WB_INKS = ["ink", "blue", "red", "green", "orange"] as const;
export const WB_TONES = ["good", "bad", "warn"] as const;
export const WB_LISTS = ["bullet", "check", "cross", "number"] as const;
export const WB_RESERVES = ["bottom", "top", "none"] as const;
export const WB_SPLITS = ["rows", "cols", "diagonal"] as const;
export const WB_LIMITS = { scenes: 24, beats: 8, items: 8, seconds: 600, sceneSeconds: 90, grid: 5, product: 3 } as const;

export type WbTheme = (typeof WB_THEMES)[number];
export type WbInk = (typeof WB_INKS)[number];
export type WbTone = (typeof WB_TONES)[number];
export type WbReserve = (typeof WB_RESERVES)[number];

const ink = z.enum(WB_INKS);
const itemSchema = z.object({ id: slug, picture, label: text(24), ink: ink.optional() });
const cell = z.union([z.number(), z.string().max(4)]);
const grid = <T extends z.ZodType>(of: T, most: number) =>
  z
    .array(z.array(of).min(1).max(most))
    .min(1)
    .max(most)
    .refine((rows) => rows.every((row) => row.length === rows[0].length), { message: "every row needs the same number of cells" });
const side = z.object({ title: text(20), items: z.array(text(28)).min(1).max(4) });

export const WB_PIECES = {
  title: z.object({ type: z.literal("title"), text: text(48), kicker: text(28).optional() }),
  write: z.object({ type: z.literal("write"), text: text(140), ink: ink.optional() }),
  list: z.object({
    type: z.literal("list"),
    style: z.enum(WB_LISTS),
    items: z.array(text(40)).min(2).max(5),
  }),
  draw: z.object({ type: z.literal("draw"), items: z.array(itemSchema).min(1).max(4) }),
  link: z.object({
    type: z.literal("link"),
    from: slug,
    to: slug,
    label: text(18).optional(),
    ink: ink.optional(),
  }),
  flow: z.object({ type: z.literal("flow"), path: z.array(slug).min(2).max(6), label: text(18).optional() }),
  circle: z.object({
    type: z.literal("circle"),
    ids: z.array(slug).min(1).max(4),
    tone: z.enum(WB_TONES),
    label: text(20).optional(),
  }),
  cross: z.object({ type: z.literal("cross"), ids: z.array(slug).min(1).max(4), label: text(20).optional() }),
  number: z.object({
    type: z.literal("number"),
    to: z.number(),
    from: z.number().optional(),
    decimals: z.int().min(0).max(2).optional(),
    prefix: z.string().max(4).optional(),
    suffix: z.string().max(8).optional(),
    label: text(40),
  }),
  bars: z.object({
    type: z.literal("bars"),
    items: z
      .array(z.object({ label: text(14), value: z.number().min(0), ink: ink.optional() }))
      .min(2)
      .max(6),
    unit: z.string().max(8).optional(),
  }),
  compare: z.object({
    type: z.literal("compare"),
    left: side,
    right: side,
    winner: z.enum(["left", "right"]).optional(),
  }),
  formula: z.object({ type: z.literal("formula"), text: text(40) }),
  matrix: z.object({
    type: z.literal("matrix"),
    cells: grid(cell, WB_LIMITS.grid),
    name: text(16).optional(),
    split: z.enum(WB_SPLITS).optional(),
    ink: ink.optional(),
  }),
  multiply: z
    .object({
      type: z.literal("multiply"),
      a: grid(z.number(), WB_LIMITS.product),
      b: grid(z.number(), WB_LIMITS.product),
      work: z.boolean().default(true),
    })
    .refine((piece) => piece.a[0].length === piece.b.length, { message: "columns of a must equal rows of b" }),
} as const;

export type WbPieceType = keyof typeof WB_PIECES;

export const wbPieceSchema = z.discriminatedUnion("type", [
  WB_PIECES.title,
  WB_PIECES.write,
  WB_PIECES.list,
  WB_PIECES.draw,
  WB_PIECES.link,
  WB_PIECES.flow,
  WB_PIECES.circle,
  WB_PIECES.cross,
  WB_PIECES.number,
  WB_PIECES.bars,
  WB_PIECES.compare,
  WB_PIECES.formula,
  WB_PIECES.matrix,
  WB_PIECES.multiply,
]);
export type WbPiece = z.infer<typeof wbPieceSchema>;
export type WbPieceOf<T extends WbPieceType> = Extract<WbPiece, { type: T }>;
export type WbItem = z.infer<typeof itemSchema>;

export const wbBeatSchema = z.object({ cue: text(40), piece: wbPieceSchema });
export type WbBeat = z.infer<typeof wbBeatSchema>;

const wordSchema = z.object({ word: z.string().max(64), start: z.number().min(0), end: z.number().min(0) });

export const wbSceneSchema = z
  .object({
    seconds: z.number().positive().max(WB_LIMITS.sceneSeconds),
    words: z.array(wordSchema).max(400).default([]),
    voice: z.string().max(2048).optional(),
    beats: z.array(wbBeatSchema).min(1).max(WB_LIMITS.beats),
  })
  .superRefine((scene, ctx) => {
    const drawn = new Set<string>();
    scene.beats.forEach((beat, i) => {
      const piece = beat.piece;
      const need = (ids: readonly string[]) => {
        for (const id of ids)
          if (!drawn.has(id))
            ctx.addIssue({ code: "custom", path: ["beats", i, "piece"], message: `"${id}" is not drawn earlier in this scene` });
      };
      if (piece.type === "draw")
        for (const item of piece.items) {
          if (drawn.has(item.id))
            ctx.addIssue({ code: "custom", path: ["beats", i, "piece"], message: `"${item.id}" is drawn twice` });
          drawn.add(item.id);
        }
      if (piece.type === "link") need([piece.from, piece.to]);
      if (piece.type === "flow") need(piece.path);
      if (piece.type === "circle" || piece.type === "cross") need(piece.ids);
    });
    if (drawn.size > WB_LIMITS.items)
      ctx.addIssue({ code: "custom", path: ["beats"], message: `at most ${WB_LIMITS.items} drawn items per scene` });
  });
export type WbScene = z.infer<typeof wbSceneSchema>;

export const wbFilmSchema = z
  .object({
    fps: z.int().min(24).max(60),
    width: z.int().min(320).max(3840),
    height: z.int().min(320).max(3840),
    theme: z.enum(WB_THEMES).default("whiteboard"),
    reserve: z.enum(WB_RESERVES).default("bottom"),
    marker: z.boolean().default(true),
    scenes: z.array(wbSceneSchema).min(1).max(WB_LIMITS.scenes),
    pictures: elementsSchema.default({}),
  })
  .refine((film) => film.scenes.reduce((sum, scene) => sum + scene.seconds, 0) <= WB_LIMITS.seconds, {
    message: `a film runs at most ${WB_LIMITS.seconds} seconds`,
  });
export type WbFilm = z.infer<typeof wbFilmSchema>;
export type WbFilmInput = z.input<typeof wbFilmSchema>;
