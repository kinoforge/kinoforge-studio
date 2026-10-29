export {
  DEFAULT_EXPLAINER_PROPS,
  EXPLAINER_COMPOSITION_ID,
  ExplainerScene,
  type ExplainerProps,
  explainerCalcMeta,
} from "./composition.tsx";
export { BOARD_ICON_KEYS, BOARD_ICONS, type BoardIcon } from "./icons.ts";
export { ExplainerKit, KIT_ASSET_KINDS, type KitAsset, type KitAssetKind } from "./kit.ts";
export { MASCOTS, MascotFigure, type MascotPose } from "./mascot.tsx";
export {
  type Beat,
  type Board,
  CAPTION_RESERVES,
  type CaptionReserve,
  MASCOT_HATS,
  MASCOT_RIGS,
  type Mascot,
  type MascotHat,
  type MascotRig,
  MOODS,
  type Mood,
  PIECE_KINDS,
  type Piece,
  type PieceType,
  boardSchema,
  boardThemeSchema,
  mascotSchema,
} from "./spec.ts";
export { BOARD_THEMES, type BoardPalette, type BoardTheme, BoardThemes } from "./theme.ts";
export { BoardCues, BoardLayout, BoardStack } from "./timeline.ts";
