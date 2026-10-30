import { z } from "zod";
import { BOARD_ICON_GROUPS, BOARD_ICONS, BOARD_ICON_KEYS } from "./icons/index.ts";
import { MASCOTS } from "./mascot.tsx";
import { EXPLAINER_COMPOSITION_ID } from "./composition.tsx";
import {
  CAPTION_RESERVES,
  MASCOT_HATS,
  MOODS,
  PIECE_KINDS,
  type PieceLayer,
  SURFACES,
  type Surface,
  boardSchema,
} from "./spec.ts";
import { type Stage, stageSchema } from "./stage.ts";
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

/** How each surface is used, and the stage part that means a video draws on it. */
const SURFACE_GUIDES: Record<Surface, { part: keyof Stage; about: string }> = {
  diagram: {
    part: "nodes",
    about:
      "DIAGRAM: a system, a structure or something moving between parts becomes one diagram that stays on screen into the next scenes, so carry on from it instead of starting over. Its nodes are the STAGE's: use their ids only. Nodes are laid out for you. show the parts as the narration names them, flow a request or an event along its path, broadcast what one part sends to many, mark the part the narration points at, hide what leaves: show, flow and broadcast bring on the nodes they name; only hide takes them off. Send things only between parts that talk to each other. A board with any of these draws on the diagram alone, with its other pieces one at a time in a band above it.",
  },
  code: {
    part: "files",
    about:
      "CODE: code the narration walks through goes in one code editor that stays on screen into the next scenes. Its files are the STAGE's: use their ids, and copy line text exactly from them. code opens a file and types it in, a few lines at a time (through) as the narration reaches them; focus lights the lines the narration is talking about, so keep explaining the open file with focus instead of opening it again. A board with any of these draws on the editor alone, with its other pieces one at a time beside it.",
  },
  road: {
    part: "road",
    about:
      "ROAD: a driving lesson happens on one road seen from above that stays on screen into the next scenes, cars and all, so carry on from it. you is the learner's car, which drives up the screen; the road's arms are named from it: back (where you come from), left, ahead, right. road sets where the narration is; drive brings you and other traffic in from an arm, to wait at the line or out by an arm, in the order the narration tells it. Traffic keeps to the STAGE's road side. A board with any of these draws on the road alone, with its other pieces one at a time beside it.",
  },
  map: {
    part: "places",
    about:
      "MAP: places, countries and journeys go on one map of the world that stays on screen into the next scenes, so carry on from it. Its places are the STAGE's: use their ids only. pin the places the narration names, draw a route for a journey (by plane, ship or car, via the places it passes so a ship rounds a cape instead of crossing land), fill the countries it talks about with zone (ISO 3166 alpha-3 codes), and move the map with map only when the narration changes region. A board with any of these draws on the map alone, with its other pieces one at a time beside it.",
  },
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
 *  it is derived from spec.ts, icons/ and the mascot rigs, so they never drift apart. */
export class ExplainerKit {
  static readonly VERSION = 8;

  static schema(): Record<string, unknown> {
    return ExplainerKit.json(boardSchema);
  }

  /** What a writer reads, in parts a caller cuts to one video: the board and its cards, each
   *  surface (kept when the stage names it or has its `part`), and the lists the stage narrows
   *  by its `pick` field. */
  static catalog() {
    const beats = (ExplainerKit.schema() as JsonSchema).properties?.beats ?? {};
    const board = [
      `BOARD: {"mood": ${MOODS.join("|")}, "beats": ${beats.minItems} to ${beats.maxItems} of {"cue": text, "piece": PIECE, "clear"?: true|false}}`,
      "cue: words of the narration, copied exactly, where the piece appears. Beats go in narration order.",
      "clear: true wipes the cards shown before it. stamp is laid over the board, not stacked.",
      "PIECES:",
      ...ExplainerKit.pieces("card", "overlay"),
    ].join("\n");
    return {
      board,
      surfaces: SURFACES.map((key) => ({
        key,
        part: SURFACE_GUIDES[key].part,
        text: [
          SURFACE_GUIDES[key].about,
          `${key.toUpperCase()} PIECES:`,
          ...ExplainerKit.pieces(key),
        ].join("\n"),
      })),
      lists: [{ name: "ICONS", pick: "icons", keys: BOARD_ICON_KEYS }],
    };
  }

  /** The format of a video's stage: the diagram nodes, code files, road side and map places
   *  its boards share, and the surfaces and icons they draw. */
  static stageCatalog(): string {
    const fields = (ExplainerKit.json(stageSchema) as JsonSchema).properties ?? {};
    const many = (field: JsonSchema = {}) =>
      `${field.minItems ?? 0} to ${field.maxItems} of ${Signature.of(field.items ?? {})}`;
    return [
      `STAGE: {"nodes": ${many(fields.nodes)}, "files"?: ${many(fields.files)}, "road"?: ${Signature.of(fields.road ?? {})}, "places"?: ${many(fields.places)}, "surfaces": ${many(fields.surfaces)}, "icons": ${many(fields.icons)}}`,
      "ICONS:",
      ...Object.entries(BOARD_ICON_GROUPS).map(
        ([group, icons]) => `- ${group}: ${Object.keys(icons).join(", ")}`,
      ),
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
