import { z } from "zod";
import { BOARD_ICONS } from "./icons.ts";
import { MASCOTS } from "./mascot.tsx";
import { EXPLAINER_COMPOSITION_ID } from "./composition.tsx";
import {
  CAPTION_RESERVES,
  MASCOT_HATS,
  MOODS,
  PIECE_KINDS,
  type PieceLayer,
  boardSchema,
} from "./spec.ts";
import { stageSchema } from "./stage.ts";
import { BOARD_THEMES } from "./theme.ts";

export const KIT_ASSET_KINDS = ["icon", "mascot", "hat", "theme"] as const;
export type KitAssetKind = (typeof KIT_ASSET_KINDS)[number];

export interface KitAsset {
  key: string;
  kind: KitAssetKind;
  name: string;
  tags: readonly string[];
}

type JsonSchema = {
  type?: string;
  description?: string;
  enum?: readonly unknown[];
  const?: unknown;
  pattern?: string;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
};

/** Field signatures for the writer, read off each piece's JSON schema. */
class Signature {
  static of(schema: JsonSchema): string {
    if (schema.enum || schema.pattern) return schema.description ?? schema.enum?.join("|") ?? "id";
    switch (schema.type) {
      case "string":
        return schema.maxLength ? `text up to ${schema.maxLength} chars` : "text";
      case "number":
      case "integer":
        return Signature.range(schema.type, schema.minimum, schema.maximum);
      case "boolean":
        return "true|false";
      case "array":
        return `${schema.minItems ?? 0} to ${schema.maxItems ?? "many"} of ${Signature.of(schema.items ?? {})}`;
      case "object":
        return `{${Signature.fields(schema).join(", ")}}`;
      default:
        return "value";
    }
  }

  static fields(schema: JsonSchema): string[] {
    const required = new Set(schema.required ?? []);
    return Object.entries(schema.properties ?? {})
      .filter(([key]) => key !== "type")
      .map(([key, field]) => `${key}${required.has(key) ? "" : "?"}: ${Signature.of(field)}`);
  }

  private static range(type: string, min?: number, max?: number): string {
    if (min == null && max == null) return type;
    return `${type} ${min ?? ""}..${max ?? ""}`;
  }
}

/** The explainer kit as data: the board's JSON schema (for any validator), the catalog a
 *  writer model reads, and the registry of named assets a board or a picker may use. All of
 *  it is derived from spec.ts, icons.ts and the mascot rigs, so they never drift apart. */
export class ExplainerKit {
  static readonly VERSION = 5;

  static schema(): Record<string, unknown> {
    return ExplainerKit.json(boardSchema);
  }

  static catalog(): string {
    const beats = (ExplainerKit.schema() as JsonSchema).properties?.beats ?? {};
    return [
      `BOARD: {"mood": ${MOODS.join("|")}, "beats": ${beats.minItems} to ${beats.maxItems} of {"cue": text, "piece": PIECE, "clear"?: true|false}}`,
      "cue: words of the narration, copied exactly, where the piece appears. Beats go in narration order.",
      "clear: true wipes the cards shown before it. stamp is laid over the board, not stacked.",
      "PIECES:",
      ...ExplainerKit.pieces("card", "overlay"),
      "DIAGRAM: these pieces draw on one diagram that stays on screen into the next scenes. Its nodes are the STAGE's: use their ids. Nodes are laid out for you. A scene with any of these shows the diagram, with its other pieces one at a time in a band above it. show, flow and broadcast bring on the nodes they name; only hide takes them off.",
      "DIAGRAM PIECES:",
      ...ExplainerKit.pieces("diagram"),
      "CODE: these pieces write in one code editor that stays on screen into the next scenes. Its files are the STAGE's: use their ids, and copy line text exactly from them. A scene with any of these shows the editor, with its other pieces one at a time beside it.",
      "CODE PIECES:",
      ...ExplainerKit.pieces("code"),
      "ROAD: these pieces happen on one road seen from above that stays on screen into the next scenes, cars and all. you is the learner's car, which drives up the screen; the road's arms are named from it: back (where you come from), left, ahead, right. Traffic keeps to the STAGE's road side. A scene with any of these shows the road, with its other pieces one at a time beside it.",
      "ROAD PIECES:",
      ...ExplainerKit.pieces("road"),
      "MAP: these pieces draw on one map of the world that stays on screen into the next scenes. Its places are the STAGE's: use their ids. Countries are ISO 3166 alpha-3 codes. A scene with any of these shows the map, with its other pieces one at a time beside it.",
      "MAP PIECES:",
      ...ExplainerKit.pieces("map"),
      "A board draws on one of the diagram, the code, the road or the map, never two.",
      `ICONS: ${Object.keys(BOARD_ICONS).join(", ")}`,
    ].join("\n");
  }

  /** The format of a video's stage: the diagram nodes, code files, road side and map places
   *  its boards share. */
  static stageCatalog(): string {
    const fields = (ExplainerKit.json(stageSchema) as JsonSchema).properties ?? {};
    const many = (field: JsonSchema = {}) =>
      `${field.minItems ?? 0} to ${field.maxItems} of ${Signature.of(field.items ?? {})}`;
    return [
      `STAGE: {"nodes": ${many(fields.nodes)}, "files"?: ${many(fields.files)}, "road"?: ${Signature.of(fields.road ?? {})}, "places"?: ${many(fields.places)}}`,
      `ICONS: ${Object.keys(BOARD_ICONS).join(", ")}`,
    ].join("\n");
  }

  private static pieces(...layers: PieceLayer[]): string[] {
    return Object.entries(PIECE_KINDS)
      .filter(([, entry]) => layers.includes(entry.layer))
      .map(([type, entry]) => {
        const fields = Signature.fields(z.toJSONSchema(entry.schema) as JsonSchema);
        return `- ${type}: ${entry.about}\n  fields: ${fields.join("; ")}\n  example: ${JSON.stringify(entry.example)}`;
      });
  }

  private static json(schema: z.ZodType): Record<string, unknown> {
    return z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" }) as Record<
      string,
      unknown
    >;
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
      ...BOARD_THEMES.map((key) => ({ key, kind: "theme" as const, name: named(key), tags: [] })),
    ];
  }

  static describe() {
    return {
      version: ExplainerKit.VERSION,
      composition: EXPLAINER_COMPOSITION_ID,
      reserves: CAPTION_RESERVES,
      schema: ExplainerKit.schema(),
      catalog: ExplainerKit.catalog(),
      stage: { schema: ExplainerKit.json(stageSchema), catalog: ExplainerKit.stageCatalog() },
      assets: ExplainerKit.assets(),
    };
  }
}
