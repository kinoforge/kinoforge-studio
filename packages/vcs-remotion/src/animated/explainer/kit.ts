import { CODE_EXTENSIONS, CODE_LANGS, SHOWN_FILES } from "./code/spec.ts";
import { STAGE_REF } from "../shared/fields.ts";
import { ELEMENT_KINDS, ELEMENT_LIMITS, elementSchema } from "../shared/elements/spec.ts";
import { BOARD_ICONS, BOARD_ICON_KEYS } from "../shared/icons/index.ts";
import { Signature } from "../shared/signature.ts";
import { BOARD_COLOR_KEYS, BoardThemes } from "../shared/theme.ts";
import { MASCOTS } from "./mascot.tsx";
import { EXPLAINER_COMPOSITION_ID } from "./composition.tsx";
import { CAPTION_RESERVES, MASCOT_HATS, PIECE_KINDS, SURFACES, boardSchema } from "./spec.ts";
import { SURFACE_PARTS, stageSchema } from "./stage.ts";

export const KIT_ASSET_KINDS = ["icon", "mascot", "hat", "theme"] as const;
export type KitAssetKind = (typeof KIT_ASSET_KINDS)[number];

export interface KitAsset {
  key: string;
  kind: KitAssetKind;
  name: string;
  tags: readonly string[];
  swatch?: { background: string; ink: string; accent: string };
}

export class ExplainerKit {
  static readonly VERSION = 15;
  static readonly PIECE = "PIECE";

  static schema(): Record<string, unknown> {
    return Signature.json(boardSchema);
  }

  static pieces() {
    return Object.entries(PIECE_KINDS).map(([type, entry]) => ({
      type,
      layer: entry.layer,
      fields: Signature.fields(Signature.json(entry.schema)).join("; "),
      example: entry.example,
    }));
  }

  static assets(): KitAsset[] {
    const named = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);
    return [
      ...Object.entries(BOARD_ICONS).map(([key, entry]) => ({
        key,
        kind: "icon" as const,
        name: named(key),
        tags: entry.tags,
      })),
      ...Object.entries(MASCOTS).map(([key, rig]) => ({
        key,
        kind: "mascot" as const,
        name: rig.name,
        tags: rig.tags,
      })),
      ...MASCOT_HATS.map((key) => ({ key, kind: "hat" as const, name: named(key), tags: [] })),
      ...BoardThemes.swatches(),
    ];
  }

  static describe() {
    const board = ExplainerKit.schema();
    const stage = Signature.json(stageSchema);
    return {
      version: ExplainerKit.VERSION,
      composition: EXPLAINER_COMPOSITION_ID,
      reserves: CAPTION_RESERVES,
      schema: board,
      board: { format: Signature.of(board, { piece: ExplainerKit.PIECE }) },
      pieces: ExplainerKit.pieces(),
      surfaces: SURFACES.map((key) => ({ key, part: SURFACE_PARTS[key] })),
      lists: [{ name: "icons", pick: "icons", keys: BOARD_ICON_KEYS }],
      stage: { schema: stage, format: Signature.of(stage), ref: STAGE_REF },
      elements: {
        kinds: ELEMENT_KINDS,
        limits: ELEMENT_LIMITS,
        schema: Signature.json(elementSchema),
      },
      code: { langs: CODE_LANGS, extensions: CODE_EXTENSIONS, most: SHOWN_FILES },
      colors: BOARD_COLOR_KEYS,
      assets: ExplainerKit.assets(),
    };
  }
}
