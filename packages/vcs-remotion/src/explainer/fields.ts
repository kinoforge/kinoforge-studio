import { z } from "zod";
import { BOARD_ICON_KEYS } from "./icons.ts";

export const text = (max: number) => z.string().trim().min(1).max(max);
export const icon = z.enum(BOARD_ICON_KEYS).describe("a key from ICONS");
