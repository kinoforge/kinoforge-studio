import { z } from "zod";
import { icon, text } from "../fields.ts";

export const MARK_TONES = ["focus", "good", "bad", "warn"] as const;
export type MarkTone = (typeof MARK_TONES)[number];

const nodeKey = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]*$/)
  .max(24);
const nodeId = nodeKey.describe("an id from STAGE");
const link = z.object({ from: nodeId, to: nodeId, label: text(16).optional() });

export const showPiece = z.object({
  type: z.literal("show"),
  nodes: z.array(nodeId).min(1).max(6).optional(),
  links: z.array(link).min(1).max(6).optional(),
});
export const flowPiece = z.object({
  type: z.literal("flow"),
  path: z.array(nodeId).min(2).max(6),
  label: text(14).optional(),
});
export const broadcastPiece = z.object({
  type: z.literal("broadcast"),
  from: nodeId,
  to: z.array(nodeId).min(1).max(6),
  label: text(14).optional(),
});
export const markPiece = z.object({
  type: z.literal("mark"),
  nodes: z.array(nodeId).min(1).max(4),
  tone: z.enum(MARK_TONES),
  label: text(14).optional(),
});
export const hidePiece = z.object({
  type: z.literal("hide"),
  nodes: z.array(nodeId).min(1).max(8).optional(),
  links: z.array(link).min(1).max(6).optional(),
  all: z.boolean().optional(),
});

export const stageNodeSchema = z.object({
  id: nodeKey.describe("short kebab-case, unique"),
  label: text(18),
  icon,
  detail: text(26).optional(),
});
export type StageNode = z.infer<typeof stageNodeSchema>;

/** The parts every diagram of one video is drawn from, named once so boards written apart
 *  still point at the same nodes. */
export const stageSchema = z.object({ nodes: z.array(stageNodeSchema).max(16) });
export type Stage = z.infer<typeof stageSchema>;

export type DiagramLink = z.infer<typeof link>;
