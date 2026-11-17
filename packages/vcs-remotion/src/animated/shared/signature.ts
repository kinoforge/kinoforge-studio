import { z } from "zod";
import { SLUG_PATTERN, STAGE_REF } from "./fields.ts";

export type JsonSchema = {
  type?: string;
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
  oneOf?: readonly JsonSchema[];
  [STAGE_REF]?: string;
};

export class Signature {
  static json(schema: z.ZodType): JsonSchema & Record<string, unknown> {
    return z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" }) as JsonSchema &
      Record<string, unknown>;
  }

  static of(schema: JsonSchema, swaps: Record<string, string> = {}): string {
    if (schema[STAGE_REF]) return `id of ${schema[STAGE_REF]}`;
    if (schema.const !== undefined) return String(schema.const);
    if (schema.enum) return schema.enum.join("|");
    if (schema.pattern) {
      return schema.pattern === SLUG_PATTERN ? "id" : `text matching ${schema.pattern}`;
    }
    switch (schema.type) {
      case "string":
        return schema.maxLength ? `text up to ${schema.maxLength} chars` : "text";
      case "number":
      case "integer":
        return Signature.range(schema.type, schema.minimum, schema.maximum);
      case "boolean":
        return "true|false";
      case "array":
        return `${schema.minItems ?? 0} to ${schema.maxItems ?? "many"} of ${Signature.of(schema.items ?? {}, swaps)}`;
      case "object":
        return `{${Signature.fields(schema, swaps).join(", ")}}`;
      default:
        return "value";
    }
  }

  static fields(schema: JsonSchema, swaps: Record<string, string> = {}): string[] {
    const required = new Set(schema.required ?? []);
    return Object.entries(schema.properties ?? {})
      .filter(([key]) => key !== "type")
      .map(
        ([key, field]) =>
          `${key}${required.has(key) ? "" : "?"}: ${swaps[key] ?? Signature.of(field, swaps)}`,
      );
  }

  private static range(type: string, min?: number, max?: number): string {
    if (min == null && max == null) return type;
    return `${type} ${min ?? ""}..${max ?? ""}`;
  }
}
