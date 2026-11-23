import { BOARD_ICON_KEYS } from "../shared/icons/index.ts";
import { Signature } from "../shared/signature.ts";
import { WHITEBOARD_COMPOSITION_ID } from "./composition.tsx";
import {
  WB_INKS,
  WB_LIMITS,
  WB_LISTS,
  WB_PIECES,
  WB_RESERVES,
  WB_SPLITS,
  WB_THEMES,
  WB_TONES,
  type WbPiece,
  type WbPieceType,
  wbFilmSchema,
} from "./spec.ts";

const EXAMPLES: { [K in WbPieceType]: Extract<WbPiece, { type: K }> } = {
  title: { type: "title", text: "What is a matrix?", kicker: "Linear algebra" },
  write: { type: "write", text: "A vector is a list of numbers that points in space", ink: "blue" },
  list: { type: "list", style: "check", items: ["Grid of numbers", "Built from vectors"] },
  draw: { type: "draw", items: [{ id: "app", picture: "phone", label: "Your phone" }] },
  link: { type: "link", from: "app", to: "api", label: "request" },
  flow: { type: "flow", path: ["app", "api", "db"], label: "pay" },
  circle: { type: "circle", ids: ["app"], tone: "good", label: "paid once" },
  cross: { type: "cross", ids: ["api"], label: "down" },
  number: { type: "number", to: 2, suffix: "x", label: "charged for one tap" },
  bars: { type: "bars", items: [{ label: "CPU", value: 3 }, { label: "GPU", value: 40 }], unit: "x" },
  compare: { type: "compare", left: { title: "No key", items: ["Pays twice"] }, right: { title: "With key", items: ["Pays once"] }, winner: "right" },
  formula: { type: "formula", text: "same key = same result" },
  matrix: { type: "matrix", cells: [[1, 0], [0, 1]], name: "Identity", split: "diagonal" },
  multiply: { type: "multiply", a: [[1, 2], [3, 4]], b: [[5, 6], [7, 8]], work: true },
};

export class WhiteboardKit {
  static readonly VERSION = 1;
  static readonly MOST_PROBLEMS = 12;

  static describe() {
    return {
      version: WhiteboardKit.VERSION,
      composition: WHITEBOARD_COMPOSITION_ID,
      pieces: Object.entries(WB_PIECES).map(([type, schema]) => ({
        type,
        fields: Signature.fields(Signature.json(schema)).join("; "),
        example: EXAMPLES[type as WbPieceType],
      })),
      pictures: BOARD_ICON_KEYS,
      themes: WB_THEMES,
      reserves: WB_RESERVES,
      inks: WB_INKS,
      tones: WB_TONES,
      lists: WB_LISTS,
      splits: WB_SPLITS,
      limits: WB_LIMITS,
    };
  }

  static check(film: unknown): string[] {
    const parsed = wbFilmSchema.safeParse(film);
    if (parsed.success) return [];
    return parsed.error.issues
      .slice(0, WhiteboardKit.MOST_PROBLEMS)
      .map((issue) => `${issue.path.join(".") || "film"}: ${issue.message}`);
  }
}
