import type { LucideIcon } from "lucide-react";
import { ENGINEERING_ICONS } from "./engineering.ts";
import { GENERAL_ICONS } from "./general.ts";
import { SCIENCE_ICONS } from "./science.ts";

export interface BoardIconEntry {
  icon: LucideIcon;
  tags: readonly string[];
}

export const BOARD_ICONS = { ...GENERAL_ICONS, ...SCIENCE_ICONS, ...ENGINEERING_ICONS };
export type BoardIcon = keyof typeof BOARD_ICONS;
export const BOARD_ICON_KEYS = Object.keys(BOARD_ICONS) as [BoardIcon, ...BoardIcon[]];
