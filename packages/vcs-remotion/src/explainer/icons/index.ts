import type { LucideIcon } from "lucide-react";
import { ENGINEERING_ICONS } from "./engineering.ts";
import { GENERAL_ICONS } from "./general.ts";
import { SCIENCE_ICONS } from "./science.ts";

export interface BoardIconEntry {
  icon: LucideIcon;
  tags: readonly string[];
}

/** The icons a board may name, in the groups a stage writer picks from, each with words a
 *  writer or a picker finds it by. A key is in one group only. */
export const BOARD_ICON_GROUPS = {
  general: GENERAL_ICONS,
  science: SCIENCE_ICONS,
  engineering: ENGINEERING_ICONS,
} as const;

export const BOARD_ICONS = { ...GENERAL_ICONS, ...SCIENCE_ICONS, ...ENGINEERING_ICONS };
export type BoardIcon = keyof typeof BOARD_ICONS;
export const BOARD_ICON_KEYS = Object.keys(BOARD_ICONS) as [BoardIcon, ...BoardIcon[]];
