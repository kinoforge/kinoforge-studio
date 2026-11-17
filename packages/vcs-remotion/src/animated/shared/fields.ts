import { z } from "zod";

export const text = (max: number) => z.string().trim().min(1).max(max);
export const icon = text(40);
export const picture = text(40);
export const SLUG_PATTERN = "^[a-z0-9][a-z0-9-]*$";
export const slug = z.string().trim().regex(new RegExp(SLUG_PATTERN)).max(24);

export const STAGE_REF = "x-stage";
export const STAGE_REF_PARTS = ["nodes", "files", "places"] as const;
export const stageRef = (part: (typeof STAGE_REF_PARTS)[number]) =>
  slug.meta({ [STAGE_REF]: part });
