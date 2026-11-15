import { z } from "zod";
import { BOARD_ICON_KEYS } from "./icons/index.ts";

export const text = (max: number) => z.string().trim().min(1).max(max);
export const icon = z.enum(BOARD_ICON_KEYS).describe("a key from ICONS");
/** A short kebab-case id a board points at, named once on the stage. */
export const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]*$/)
  .max(24);

export const STAGE_REF = "x-stage";
export const STAGE_REF_PARTS = ["nodes", "files", "places"] as const;
export const stageRef = (part: (typeof STAGE_REF_PARTS)[number], about: string) =>
  slug.describe(about).meta({ [STAGE_REF]: part });
