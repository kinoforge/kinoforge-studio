import { z } from "zod";
import { BOARD_ICONS } from "./icons.ts";
import { MASCOTS } from "./mascot.tsx";
import { EXPLAINER_COMPOSITION_ID } from "./composition.tsx";
import { CAPTION_RESERVES, MASCOT_HATS, MOODS, PIECE_KINDS, boardSchema } from "./spec.ts";
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
    if (schema.enum) return schema.description ?? schema.enum.join("|");
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
  static readonly VERSION = 1;

  static schema(): Record<string, unknown> {
    return z.toJSONSchema(boardSchema, { target: "draft-2020-12", io: "input" }) as Record<
      string,
      unknown
    >;
  }

  static catalog(): string {
    const pieces = Object.entries(PIECE_KINDS).map(([type, entry]) => {
      const fields = Signature.fields(z.toJSONSchema(entry.schema) as JsonSchema);
      return `- ${type}: ${entry.about}\n  fields: ${fields.join("; ")}\n  example: ${JSON.stringify(entry.example)}`;
    });
    return [
      `BOARD: {"mood": ${MOODS.join("|")}, "beats": 1 to 6 of {"cue": text, "piece": PIECE, "clear"?: true|false}}`,
      "cue: words of the narration, copied exactly, where the piece appears. Beats go in narration order.",
      "clear: true wipes the pieces shown before it. stamp is laid over the board, not stacked.",
      "PIECES:",
      ...pieces,
      `ICONS: ${Object.keys(BOARD_ICONS).join(", ")}`,
    ].join("\n");
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
      assets: ExplainerKit.assets(),
    };
  }
}
