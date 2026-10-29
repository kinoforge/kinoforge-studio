import type { CodeLang } from "./spec.ts";

export const TOKEN_KINDS = [
  "plain",
  "keyword",
  "string",
  "number",
  "comment",
  "call",
  "type",
  "punct",
] as const;
export type TokenKind = (typeof TOKEN_KINDS)[number];

export interface Token {
  kind: TokenKind;
  text: string;
}

interface Grammar {
  words: string;
  comment: string[];
  block?: boolean;
  caseless?: boolean;
  types?: boolean;
}

const C = { comment: ["//"], block: true, types: true };

const GRAMMARS: Record<CodeLang, Grammar> = {
  typescript: {
    ...C,
    words:
      "abstract as async await break case catch class const constructor continue default delete do else enum export extends false finally for from function get if implements import in instanceof interface let new null of private protected public readonly return set static super switch this throw true try type typeof undefined var void while yield",
  },
  javascript: {
    ...C,
    words:
      "async await break case catch class const constructor continue default delete do else export extends false finally for from function get if import in instanceof let new null of return set static super switch this throw true try typeof undefined var void while yield",
  },
  python: {
    comment: ["#"],
    types: true,
    words:
      "and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return self True try while with yield",
  },
  java: {
    ...C,
    words:
      "abstract boolean break case catch char class continue default do double else enum extends false final finally float for if implements import instanceof int interface long new null package private protected public record return short static super switch this throw throws true try var void while",
  },
  csharp: {
    ...C,
    words:
      "abstract as async await base bool break case catch class const continue decimal default delegate do double else enum event false finally float for foreach get if in int interface internal is lock long namespace new null object override params private protected public readonly ref return sealed set static string struct switch this throw true try typeof using var virtual void while",
  },
  go: {
    ...C,
    words:
      "break case chan const continue default defer else fallthrough false for func go goto if import interface map nil package range return select struct switch true type var",
  },
  rust: {
    ...C,
    words:
      "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while",
  },
  kotlin: {
    ...C,
    words:
      "abstract class companion data else enum false for fun if import in interface is null object open override package private protected public return sealed super this throw true try val var when while",
  },
  swift: {
    ...C,
    words:
      "as associatedtype break case class continue default defer do else enum extension false for func guard if import in init inout let nil private protocol public return self static struct super switch throw throws true try var where while",
  },
  cpp: {
    ...C,
    words:
      "auto bool break case catch char class const constexpr continue default delete do double else enum explicit false float for friend if include inline int long namespace new nullptr operator override private protected public return static struct switch template this throw true try typedef typename using virtual void while",
  },
  php: {
    ...C,
    comment: ["//", "#"],
    words:
      "abstract array as break case catch class const continue default echo else elseif extends false final fn for foreach function if implements interface match namespace new null private protected public return static switch this throw true try use while",
  },
  ruby: {
    comment: ["#"],
    types: true,
    words:
      "and attr_accessor attr_reader begin break case class def do else elsif end ensure false for if in module next nil not or redo rescue retry return self super then true unless until when while yield",
  },
  sql: {
    comment: ["--"],
    caseless: true,
    words:
      "all and as asc avg begin by case commit count create delete desc distinct else end foreign from group having in index inner insert into is join key left like limit max min not null on or order outer primary references right rollback select set sum table then union update values when where",
  },
  bash: {
    comment: ["#"],
    words:
      "case cd do done echo elif else esac export fi for function if in local return sudo then while",
  },
  json: { comment: [], words: "true false null" },
  text: { comment: [], words: "" },
};

const QUOTES = "\"'`";

/** Colours a short listing token by token: keywords, strings, numbers, comments, calls and
 *  type names, close enough for a viewer to read it as code. Block comments carry across
 *  lines; everything else is read one line at a time. */
export class Syntax {
  static lines(lines: readonly string[], lang: CodeLang): Token[][] {
    const grammar = GRAMMARS[lang] ?? GRAMMARS.text;
    const words = new Set(grammar.words.split(" ").filter(Boolean));
    const state = { block: false };
    return lines.map((line) => Syntax.merge(Syntax.line(line, grammar, words, state)));
  }

  private static line(
    line: string,
    grammar: Grammar,
    words: Set<string>,
    state: { block: boolean },
  ): Token[] {
    const out: Token[] = [];
    let i = 0;
    while (i < line.length) {
      if (state.block) {
        const end = line.indexOf("*/", i);
        const stop = end < 0 ? line.length : end + 2;
        out.push({ kind: "comment", text: line.slice(i, stop) });
        state.block = end < 0;
        i = stop;
        continue;
      }
      const rest = line.slice(i);
      if (grammar.block && rest.startsWith("/*")) {
        state.block = true;
        out.push({ kind: "comment", text: "/*" });
        i += 2;
        continue;
      }
      if (grammar.comment.some((mark) => rest.startsWith(mark))) {
        out.push({ kind: "comment", text: rest });
        break;
      }
      const ch = line[i];
      if (QUOTES.includes(ch) && (grammar.words || ch !== "'")) {
        let end = i + 1;
        while (end < line.length && line[end] !== ch) end += line[end] === "\\" ? 2 : 1;
        out.push({ kind: "string", text: line.slice(i, end + 1) });
        i = end + 1;
        continue;
      }
      const space = /^\s+/.exec(rest);
      if (space) {
        out.push({ kind: "plain", text: space[0] });
        i += space[0].length;
        continue;
      }
      const number = /^\d[\w.]*/.exec(rest);
      if (number) {
        out.push({ kind: "number", text: number[0] });
        i += number[0].length;
        continue;
      }
      const word = /^[@A-Za-z_$][\w$]*/.exec(rest);
      if (word) {
        out.push({
          kind: Syntax.word(word[0], line.slice(i + word[0].length), grammar, words),
          text: word[0],
        });
        i += word[0].length;
        continue;
      }
      out.push({ kind: "punct", text: ch });
      i += 1;
    }
    return out;
  }

  private static word(
    word: string,
    after: string,
    grammar: Grammar,
    words: Set<string>,
  ): TokenKind {
    if (word.startsWith("@")) return "keyword";
    if (words.has(grammar.caseless ? word.toLowerCase() : word)) return "keyword";
    if (/^\s*\(/.test(after)) return "call";
    if (grammar.types && /^[A-Z]/.test(word)) return "type";
    return "plain";
  }

  private static merge(tokens: Token[]): Token[] {
    const out: Token[] = [];
    for (const token of tokens) {
      const last = out.at(-1);
      if (last && last.kind === token.kind) last.text += token.text;
      else out.push({ ...token });
    }
    return out;
  }
}
