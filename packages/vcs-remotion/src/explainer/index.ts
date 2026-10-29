export {
  DEFAULT_EXPLAINER_PROPS,
  EXPLAINER_COMPOSITION_ID,
  ExplainerScene,
  type ExplainerProps,
  explainerCalcMeta,
} from "./composition.tsx";
export { CodeLayout, CodeScene } from "./code/scene.ts";
export { CODE_LANGS, type CodeFile, type CodeLang, codeFileSchema } from "./code/spec.ts";
export { CodeMemory, CodeScript, LineMatch } from "./code/state.ts";
export { Syntax, TOKEN_KINDS, type Token, type TokenKind } from "./code/syntax.ts";
export { DiagramLayout } from "./diagram/layout.ts";
export { DiagramScene } from "./diagram/scene.ts";
export { MARK_COLORS, MARK_TONES, type MarkTone, type StageNode } from "./diagram/spec.ts";
export { DiagramMemory, DiagramScript } from "./diagram/state.ts";
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
  PIECE_LAYERS,
  type Piece,
  type PieceLayer,
  type PieceType,
  boardSchema,
  boardThemeSchema,
  mascotSchema,
} from "./spec.ts";
export { type Stage, stageSchema } from "./stage.ts";
export { BOARD_THEMES, type BoardPalette, type BoardTheme, BoardThemes } from "./theme.ts";
export { BoardCues, BoardLayout, BoardStack, SurfaceSplit } from "./timeline.ts";
