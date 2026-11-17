import { STAGE_REF } from "../shared/fields.ts";
import { Signature } from "../shared/signature.ts";
import { BOARD_COLOR_KEYS, BOARD_GLOWS, BoardThemes } from "../shared/theme.ts";
import { CAPTION_RESERVES } from "../explainer/spec.ts";
import { SKIT_COMPOSITION_ID } from "./composition.tsx";
import { motionSchema } from "./motion.ts";
import {
  BACKDROPS,
  BACKDROP_FURNITURE,
  CARD_KINDS,
  DRAWS,
  EXPRESSIONS,
  HATS,
  HOLDS,
  MOVES,
  PLACES,
  POSES,
  PRESENTERS,
  REACTIONS,
  SET_PROPS,
  SKIT_LIMITS,
  VOICE_KINDS,
  changeSchema,
  directionSchema,
  setSchema,
} from "./spec.ts";

export class SkitKit {
  static readonly VERSION = 6;
  static readonly CHANGE = "CHANGE";

  static changes(): string[] {
    return changeSchema.options.map((option) => Signature.of(Signature.json(option)));
  }

  static describe() {
    const set = Signature.json(setSchema);
    const direction = Signature.json(directionSchema);
    const card = `0 to ${SKIT_LIMITS.changes} of ${SkitKit.CHANGE}`;
    return {
      version: SkitKit.VERSION,
      composition: SKIT_COMPOSITION_ID,
      reserves: CAPTION_RESERVES,
      ref: STAGE_REF,
      limits: SKIT_LIMITS,
      words: {
        backdrops: BACKDROPS,
        hats: HATS,
        holds: HOLDS,
        set_props: SET_PROPS,
        voices: VOICE_KINDS,
        card_kinds: CARD_KINDS,
        draws: DRAWS,
        poses: POSES,
        faces: EXPRESSIONS,
        reactions: REACTIONS,
        places: PLACES,
        moves: MOVES,
      },
      presenters: PRESENTERS,
      pictures: { hat: HATS, head: [], holds: HOLDS, kind: SET_PROPS, icon: [] },
      furniture: BACKDROP_FURNITURE,
      colors: BOARD_COLOR_KEYS,
      glows: BOARD_GLOWS,
      motion: { schema: Signature.json(motionSchema) },
      set: { schema: set, format: Signature.of(set) },
      direction: {
        schema: direction,
        format: Signature.of(direction, { card }),
        changes: SkitKit.changes(),
      },
      assets: BoardThemes.swatches(),
    };
  }
}
