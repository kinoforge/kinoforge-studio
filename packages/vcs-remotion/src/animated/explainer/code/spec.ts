import { z } from "zod";
import { MARK_TONES } from "../diagram/spec.ts";
import { slug, stageRef, text } from "../../shared/fields.ts";

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
  "yaml",
  "dockerfile",
  "toml",
  "ini",
  "diff",
  "text",
] as const;
export type CodeLang = (typeof CODE_LANGS)[number];

export const CODE_EXTENSIONS: Record<string, CodeLang> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  py: "python",
  java: "java",
  cs: "csharp",
  go: "go",
  rs: "rust",
  kt: "kotlin",
  swift: "swift",
  cpp: "cpp",
  cc: "cpp",
  h: "cpp",
  hpp: "cpp",
  php: "php",
  rb: "ruby",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  json: "json",
  yml: "yaml",
  yaml: "yaml",
  dockerfile: "dockerfile",
  containerfile: "dockerfile",
  toml: "toml",
  ini: "ini",
  cfg: "ini",
  conf: "ini",
  env: "ini",
  properties: "ini",
  diff: "diff",
  patch: "diff",
  txt: "text",
  md: "text",
};

const fileId = stageRef("files");
const lineText = text(40);

export const codePiece = z.object({
  type: z.literal("code"),
  file: fileId,
  through: lineText.optional(),
});
export const focusPiece = z.object({
  type: z.literal("focus"),
  lines: z.array(lineText).min(1).max(3),
  tone: z.enum(MARK_TONES).optional(),
  label: text(18).optional(),
});

export const codeFileSchema = z.object({
  id: slug,
  name: text(28),
  lang: z.enum(CODE_LANGS),
  lines: z.array(z.string().max(48)).min(1).max(16),
});
export type CodeFile = z.infer<typeof codeFileSchema>;

export const SHOWN_FILES = { files: 8, lines: 400, chars: 200 } as const;

export const shownFileSchema = codeFileSchema.extend({
  lines: z.array(z.string().max(SHOWN_FILES.chars)).min(1).max(SHOWN_FILES.lines),
});
