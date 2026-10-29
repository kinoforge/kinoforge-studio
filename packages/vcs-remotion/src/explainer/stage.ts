import { z } from "zod";
import { codeFileSchema } from "./code/spec.ts";
import { stageNodeSchema } from "./diagram/spec.ts";
import { stagePlaceSchema } from "./map/spec.ts";
import { roadStageSchema } from "./road/spec.ts";

/** What every board of one video points at, named once so boards written apart still share
 *  it: the diagram's nodes, the code files the video walks through, the side of the road its
 *  traffic keeps to and the places its map shows. */
export const stageSchema = z.object({
  nodes: z.array(stageNodeSchema).max(16),
  files: z.array(codeFileSchema).max(3).optional(),
  road: roadStageSchema.optional(),
  places: z.array(stagePlaceSchema).max(12).optional(),
});
export type Stage = z.infer<typeof stageSchema>;
