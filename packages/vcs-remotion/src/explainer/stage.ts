import { z } from "zod";
import { codeFileSchema } from "./code/spec.ts";
import { stageNodeSchema } from "./diagram/spec.ts";

/** What every board of one video points at, named once so boards written apart still share
 *  it: the diagram's nodes and the code files the video walks through. */
export const stageSchema = z.object({
  nodes: z.array(stageNodeSchema).max(16),
  files: z.array(codeFileSchema).max(3).optional(),
});
export type Stage = z.infer<typeof stageSchema>;
