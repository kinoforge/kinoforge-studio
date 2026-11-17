import { STAGE_REF } from "../shared/fields.ts";
import { Signature } from "../shared/signature.ts";
import { BOARD_COLOR_KEYS, PAINT_NAMES } from "../shared/theme.ts";
import { CAPTION_RESERVES } from "../explainer/spec.ts";
import { SKIT3D_COMPOSITION_ID } from "./composition.tsx";
import {
  ACTIONS,
  ACTION_CLIPS,
  FACES,
  FACE_MORPHS,
  GROUNDS,
  MOUTH_MORPHS,
  MOVES,
  PLACES,
  SHAPES,
  SHOTS,
  SKIT3D_LIMITS,
  SPOTS,
  VOICE_KINDS,
  WALK_CLIPS,
  builtSchema,
  directionSchema,
  setSchema,
} from "./spec.ts";

export class Skit3DKit {
  static readonly VERSION = 1;

  static describe() {
    const set = Signature.json(setSchema);
    const direction = Signature.json(directionSchema);
    const built = Signature.json(builtSchema);
    return {
      version: Skit3DKit.VERSION,
      composition: SKIT3D_COMPOSITION_ID,
      reserves: CAPTION_RESERVES,
      ref: STAGE_REF,
      limits: SKIT3D_LIMITS,
      words: {
        grounds: GROUNDS,
        actions: ACTIONS,
        faces: FACES,
        places: PLACES,
        moves: MOVES,
        spots: SPOTS,
        shots: SHOTS,
        voices: VOICE_KINDS,
        shapes: SHAPES,
        paints: PAINT_NAMES,
      },
      presenters: ["cast"],
      pictures: { look: [], kind: [] },
      furniture: {},
      colors: BOARD_COLOR_KEYS,
      clips: { ...ACTION_CLIPS, walk: WALK_CLIPS },
      morphs: { faces: FACE_MORPHS, mouth: MOUTH_MORPHS },
      set: { schema: set, format: Signature.of(set) },
      direction: { schema: direction, format: Signature.of(direction), changes: [] },
      model: { schema: built, format: Signature.of(built) },
    };
  }
}
