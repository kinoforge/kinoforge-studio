import { z } from "zod";
import { MARK_TONES } from "../diagram/spec.ts";
import { slug, text } from "../fields.ts";

export const CODE_LANGS = [
  "typescript",
  "javascript",
  "python",
  "java",
  "csharp",
  "go",
  "rust",
  "kotlin",
  "swift",
  "cpp",
  "php",
  "ruby",
  "sql",
  "bash",
  "json",
  "text",
] as const;
export type CodeLang = (typeof CODE_LANGS)[number];

const fileId = slug.describe("a file id from the STAGE");
const lineText = text(40).describe("text copied from one line of the file");

export const codePiece = z.object({
  type: z.literal("code"),
  file: fileId,
  through: lineText
    .optional()
    .describe("text of the last line to show; later code beats show more"),
});
export const focusPiece = z.object({
  type: z.literal("focus"),
  lines: z.array(lineText).min(1).max(3).describe("text found in each line to light up"),
  tone: z.enum(MARK_TONES).optional(),
  label: text(18).optional(),
});

export const codeFileSchema = z.object({
  id: slug.describe("short kebab-case, unique"),
  name: text(28).describe("file name, like observer.ts"),
  lang: z.enum(CODE_LANGS),
  lines: z
    .array(z.string().max(48))
    .min(1)
    .max(16)
    .describe("the code, one line each, indented with spaces"),
});
export type CodeFile = z.infer<typeof codeFileSchema>;
