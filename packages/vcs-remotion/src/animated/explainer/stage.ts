import { z } from "zod";
import { SHOWN_FILES, codeFileSchema, shownFileSchema } from "./code/spec.ts";
import { stageNodeSchema } from "./diagram/spec.ts";
import { picture } from "../shared/fields.ts";
import { stagePlaceSchema } from "./map/spec.ts";
import { roadStageSchema } from "./road/spec.ts";
import { SURFACES, type Surface } from "./spec.ts";

export const stageSchema = z.object({
  nodes: z.array(stageNodeSchema).max(16),
  files: z.array(codeFileSchema).max(3).optional(),
  road: roadStageSchema.optional(),
  places: z.array(stagePlaceSchema).max(12).optional(),
  surfaces: z.array(z.enum(SURFACES)).max(SURFACES.length).optional(),
  icons: z.array(picture).max(32).optional(),
});
export type Stage = z.infer<typeof stageSchema>;

export const SURFACE_PARTS = {
  diagram: "nodes",
  code: "files",
  road: "road",
  map: "places",
} as const satisfies Record<Surface, keyof Stage>;

export const shownStageSchema = stageSchema.extend({
  files: z.array(shownFileSchema).max(SHOWN_FILES.files).optional(),
});
