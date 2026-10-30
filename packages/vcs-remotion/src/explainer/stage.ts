import { z } from "zod";
import { codeFileSchema } from "./code/spec.ts";
import { stageNodeSchema } from "./diagram/spec.ts";
import { icon } from "./fields.ts";
import { stagePlaceSchema } from "./map/spec.ts";
import { roadStageSchema } from "./road/spec.ts";
import { SURFACES } from "./spec.ts";

/** What every board of one video points at, named once so boards written apart still share
 *  it: the diagram's nodes, the code files the video walks through, the side of the road its
 *  traffic keeps to and the places its map shows. The surfaces and icons it names cut the
 *  writer's catalog to what this video draws; a stage without them keeps all of it. */
export const stageSchema = z.object({
  nodes: z.array(stageNodeSchema).max(16),
  files: z.array(codeFileSchema).max(3).optional(),
  road: roadStageSchema.optional(),
  places: z.array(stagePlaceSchema).max(12).optional(),
  surfaces: z.array(z.enum(SURFACES)).max(SURFACES.length).optional(),
  icons: z.array(icon).max(32).optional(),
});
export type Stage = z.infer<typeof stageSchema>;
