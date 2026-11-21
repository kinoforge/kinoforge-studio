import { z } from "zod";
import { CAPTIONED_COMPOSITION_ID } from "./captioned-composition.tsx";
import { CLIP_COMPOSITION_ID } from "./clip-composition.tsx";
import { EXPLAINER_COMPOSITION_ID } from "./animated/explainer/composition.tsx";
import { elementsSchema } from "./animated/shared/elements/spec.ts";
import { shownStageSchema } from "./animated/explainer/stage.ts";
import {
  CAPTION_RESERVES,
  boardColorsSchema,
  boardGlowSchema,
  boardSchema,
  boardThemeSchema,
  mascotSchema,
} from "./animated/explainer/spec.ts";
import { SKIT_COMPOSITION_ID } from "./animated/skit/composition.tsx";
import { motionSchema } from "./animated/skit/motion.ts";
import { DRAWS, lineSchema, setSchema } from "./animated/skit/spec.ts";
import { SKIT3D_COMPOSITION_ID } from "./animated/skit3d/composition.tsx";
import {
  lineSchema as skit3dLineSchema,
  modelsSchema,
  setSchema as skit3dSetSchema,
} from "./animated/skit3d/spec.ts";
import { CAPTION_POSITIONS, STORY_COMPOSITION_ID } from "./story-composition.tsx";

const caption = z.object({ start: z.number(), end: z.number(), text: z.string() });
const captionWord = z.object({ word: z.string(), start: z.number(), end: z.number() });
const crop = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });

const clipInput = z.object({
  src: z.string(),
  inSec: z.number(),
  outSec: z.number(),
  fps: z.number().positive(),
  srcWidth: z.number().positive(),
  srcHeight: z.number().positive(),
  format: z.string(),
  captions: z.array(caption),
  showCaptions: z.boolean(),
  crop: crop.optional(),
  cropX: z.number().optional(),
});

const captionedInput = z.object({
  src: z.string(),
  fps: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  inSec: z.number(),
  durationSec: z.number().positive(),
  captions: z.array(caption),
});

const storyInput = z.object({
  scenes: z
    .array(
      z.object({
        image: z.string(),
        images: z.array(z.string()).optional(),
        video: z.string().optional(),
        video_seconds: z.number().optional(),
        video_audio: z.boolean().optional(),
        flat: z.boolean().optional(),
        audio: z.string().optional(),
        seconds: z.number().positive(),
        words: z.array(captionWord),
        joined: z.boolean().optional(),
        index: z.number().int().min(0).optional(),
        key: z.string().optional(),
      }),
    )
    .min(1),
  fps: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  showCaptions: z.boolean(),
  karaoke: z.boolean().optional(),
  captionColor: z.string().optional(),
  captionScale: z.number().optional(),
  captionPosition: z.enum(CAPTION_POSITIONS).optional(),
  sceneGap: z.number().optional(),
  reuseScenes: z.boolean().optional(),
  music: z.string().optional(),
  musicVolume: z.number().min(0).max(1).optional(),
  musicUnderVoice: z.number().min(0).max(1).optional(),
  endCard: z.object({ image: z.string(), seconds: z.number().positive() }).optional(),
});

const explainerInput = z.object({
  fps: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  seconds: z.number().positive(),
  board: boardSchema,
  words: z.array(captionWord),
  theme: boardThemeSchema.optional(),
  colors: boardColorsSchema.nullable().optional(),
  mascot: mascotSchema.nullable().optional(),
  reserve: z.enum(CAPTION_RESERVES).optional(),
  stage: shownStageSchema.nullable().optional(),
  history: z.array(boardSchema).optional(),
  next: boardSchema.nullable().optional(),
  language: z
    .string()
    .regex(/^[a-z]{2}$/)
    .optional(),
  elements: elementsSchema.optional(),
  sfx: z.boolean().optional(),
});

const skitInput = z.object({
  fps: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  seconds: z.number().positive(),
  set: setSchema,
  line: lineSchema,
  text: z.string().max(600),
  words: z.array(captionWord),
  motion: motionSchema,
  history: z.array(z.object({ line: lineSchema, text: z.string().max(600) })).optional(),
  theme: boardThemeSchema.optional(),
  colors: boardColorsSchema.nullable().optional(),
  glow: boardGlowSchema.optional(),
  reserve: z.enum(CAPTION_RESERVES).optional(),
  language: z
    .string()
    .regex(/^[a-z]{2}$/)
    .optional(),
  elements: elementsSchema.optional(),
  drawn: z
    .object({
      board: boardSchema,
      stage: shownStageSchema.nullable().optional(),
      history: z.array(boardSchema).optional(),
    })
    .nullable()
    .optional(),
  next: z
    .object({ draw: z.enum(DRAWS).optional() })
    .nullable()
    .optional(),
  sfx: z.boolean().optional(),
});

const skit3dInput = z.object({
  fps: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  seconds: z.number().positive(),
  set: skit3dSetSchema,
  line: skit3dLineSchema,
  text: z.string().max(600),
  words: z.array(captionWord),
  models: modelsSchema,
  history: z
    .array(z.object({ line: skit3dLineSchema, text: z.string().max(600) }))
    .optional(),
  theme: boardThemeSchema.optional(),
  colors: boardColorsSchema.nullable().optional(),
  reserve: z.enum(CAPTION_RESERVES).optional(),
  language: z
    .string()
    .regex(/^[a-z]{2}$/)
    .optional(),
  sfx: z.boolean().optional(),
});

export type EditDoc =
  | { compositionId: typeof CLIP_COMPOSITION_ID; inputProps: z.infer<typeof clipInput> }
  | { compositionId: typeof CAPTIONED_COMPOSITION_ID; inputProps: z.infer<typeof captionedInput> }
  | { compositionId: typeof STORY_COMPOSITION_ID; inputProps: z.infer<typeof storyInput> }
  | {
      compositionId: typeof EXPLAINER_COMPOSITION_ID;
      inputProps: z.infer<typeof explainerInput>;
    }
  | { compositionId: typeof SKIT_COMPOSITION_ID; inputProps: z.infer<typeof skitInput> }
  | { compositionId: typeof SKIT3D_COMPOSITION_ID; inputProps: z.infer<typeof skit3dInput> };

export class EditDocs {
  private static readonly schemas = {
    [CLIP_COMPOSITION_ID]: clipInput,
    [CAPTIONED_COMPOSITION_ID]: captionedInput,
    [STORY_COMPOSITION_ID]: storyInput,
    [EXPLAINER_COMPOSITION_ID]: explainerInput,
    [SKIT_COMPOSITION_ID]: skitInput,
    [SKIT3D_COMPOSITION_ID]: skit3dInput,
  } as const;

  private static readonly extra = new Map<string, z.ZodType>();

  static readonly WEBGL: ReadonlySet<string> = new Set([SKIT3D_COMPOSITION_ID]);

  static extend(schemas: Record<string, z.ZodType>): void {
    for (const [id, schema] of Object.entries(schemas)) EditDocs.extra.set(id, schema);
  }

  static webgl(compositionId: string): boolean {
    return EditDocs.WEBGL.has(compositionId);
  }

  static parse(compositionId: string, inputProps: unknown): EditDoc {
    const extra = EditDocs.extra.get(compositionId);
    if (extra) return { compositionId, inputProps: extra.parse(inputProps) } as EditDoc;
    if (!EditDocs.known(compositionId)) throw new Error(`unknown compositionId: ${compositionId}`);
    const parsed = EditDocs.schemas[compositionId].parse(inputProps);
    return { compositionId, inputProps: parsed } as EditDoc;
  }

  private static known(id: string): id is keyof typeof EditDocs.schemas {
    return id in EditDocs.schemas;
  }
}
