import { z } from "zod";

export const motionSchema = z.object({
  sway: z.number().min(0).max(1),
  gesture: z.number().min(0).max(1),
  tempo: z.number().min(0.1).max(1),
  pose_seconds: z.number().min(0.2).max(2),
  hold_pose: z.boolean(),
});
export type SkitMotion = z.infer<typeof motionSchema>;
