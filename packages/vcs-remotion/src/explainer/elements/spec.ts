import { z } from "zod";

export const ELEMENT_KINDS = ["icon", "logo"] as const;
export type ElementKind = (typeof ELEMENT_KINDS)[number];

export const ELEMENT_LIMITS = { parts: 256, path: 20000, total: 120000, side: 4096 } as const;

const paint = z.union([z.enum(["ink", "none"]), z.string().regex(/^#[0-9a-fA-F]{6}$/)]);

export const elementPartSchema = z.object({
  d: z
    .string()
    .regex(/^[MmZzLlHhVvCcSsQqTtAa0-9eE.,+\- ]+$/)
    .max(ELEMENT_LIMITS.path),
  fill: paint.optional(),
  stroke: paint.optional(),
  width: z.number().min(0).max(64).optional(),
  opacity: z.number().min(0).max(1).optional(),
  evenodd: z.boolean().optional(),
});

export const elementShapeSchema = z
  .object({
    box: z.object({
      w: z.number().positive().max(ELEMENT_LIMITS.side),
      h: z.number().positive().max(ELEMENT_LIMITS.side),
    }),
    parts: z.array(elementPartSchema).min(1).max(ELEMENT_LIMITS.parts),
  })
  .refine(
    (shape) => shape.parts.reduce((sum, part) => sum + part.d.length, 0) <= ELEMENT_LIMITS.total,
  );
export type ElementShape = z.infer<typeof elementShapeSchema>;

export const elementSchema = z.object({
  kind: z.enum(ELEMENT_KINDS),
  label: z.string().trim().min(1).max(60),
  shape: elementShapeSchema,
});
export type BoardElement = z.infer<typeof elementSchema>;

export const elementsSchema = z
  .record(z.string().trim().min(1).max(48), elementSchema)
  .refine((map) => Object.keys(map).length <= 64);
export type BoardElements = z.infer<typeof elementsSchema>;
