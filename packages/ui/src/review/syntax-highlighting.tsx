import type { ReactElement, ReactNode } from "react";

type DiffLanguage = "css" | "javascript" | "json" | "markdown" | "shell" | "typescript" | "unknown";

interface HighlightToken {
  className: string;
  text: string;
}

const maxHighlightedLineLength = 600;

export function highlightDiffLine(filePath: string, text: string | undefined): ReactNode {
  const source = text || "";
  const language = languageForPath(filePath);
  if (language === "unknown" || source.length > maxHighlightedLineLength) {
    return source;
  }

  if (language === "markdown") {
    return renderTokens(highlightMarkdown(source));
  }

  if (language === "shell") {
    return renderTokens(highlightShell(source));
  }

  if (language === "css") {
    return renderTokens(highlightPattern(source, cssPatterns));
  }

  if (language === "json") {
    return renderTokens(highlightPattern(source, jsonPatterns));
  }

  return renderTokens(highlightPattern(source, codePatterns));
}

function languageForPath(filePath: string): DiffLanguage {
  const lowerPath = filePath.toLowerCase();
  const extension = lowerPath.split(".").pop() || "";
  if (["ts", "tsx", "mts", "cts"].includes(extension)) {
    return "typescript";
  }

  if (["js", "jsx", "mjs", "cjs"].includes(extension)) {
    return "javascript";
  }

  if (extension === "json" || lowerPath.endsWith(".jsonc")) {
    return "json";
  }

  if (["md", "markdown", "mdx"].includes(extension)) {
    return "markdown";
  }

  if (["css", "scss", "sass"].includes(extension)) {
    return "css";
  }

  if (["sh", "bash", "zsh", "ps1"].includes(extension) || lowerPath.endsWith("dockerfile")) {
    return "shell";
  }

  return "unknown";
}

const codeKeywords = [
  "abstract",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "do",
  "else",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "interface",
  "let",
  "new",
  "null",
  "private",
  "protected",
  "public",
  "readonly",
  "return",
  "static",
  "switch",
  "throw",
  "true",
  "try",
  "type",
  "undefined",
  "while"
];

const codePatterns: TokenPattern[] = [
  { className: "syntax-comment", regex: /\/\/.*|\/\*.*?\*\//g },
  { className: "syntax-string", regex: /(["'`])(?:\\.|(?!\1).)*\1/g },
  { className: "syntax-keyword", regex: new RegExp(`\\b(?:${codeKeywords.join("|")})\\b`, "g") },
  { className: "syntax-number", regex: /\b\d+(?:\.\d+)?\b/g },
  { className: "syntax-function", regex: /\b[A-Za-z_$][\w$]*(?=\s*\()/g }
];

const jsonPatterns: TokenPattern[] = [
  { className: "syntax-property", regex: /"[^"\\]*(?:\\.[^"\\]*)*"(?=\s*:)/g },
  { className: "syntax-string", regex: /"[^"\\]*(?:\\.[^"\\]*)*"/g },
  { className: "syntax-keyword", regex: /\b(?:false|null|true)\b/g },
  { className: "syntax-number", regex: /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/gi }
];

const cssPatterns: TokenPattern[] = [
  { className: "syntax-comment", regex: /\/\*.*?\*\//g },
  { className: "syntax-property", regex: /[-_a-zA-Z][-_a-zA-Z0-9]*(?=\s*:)/g },
  { className: "syntax-string", regex: /(["'])(?:\\.|(?!\1).)*\1/g },
  { className: "syntax-number", regex: /#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms)?\b/g }
];

const shellPatterns: TokenPattern[] = [
  { className: "syntax-comment", regex: /#.*/g },
  { className: "syntax-string", regex: /(["'])(?:\\.|(?!\1).)*\1/g },
  { className: "syntax-keyword", regex: /\b(?:case|do|done|elif|else|esac|fi|for|function|if|in|then|while)\b/g },
  { className: "syntax-property", regex: /\$[A-Za-z_][A-Za-z0-9_]*|\$\{[^}]+\}/g },
  { className: "syntax-number", regex: /\b\d+(?:\.\d+)?\b/g }
];

interface TokenPattern {
  className: string;
  regex: RegExp;
}

function highlightMarkdown(source: string): HighlightToken[] {
  if (/^\s{0,3}#{1,6}\s/.test(source)) {
    return [{ className: "syntax-keyword", text: source }];
  }

  if (/^\s{0,3}(?:[-*+]|\d+\.)\s/.test(source)) {
    return splitWithPattern(source, { className: "syntax-keyword", regex: /^\s{0,3}(?:[-*+]|\d+\.)/g });
  }

  return highlightPattern(source, [
    { className: "syntax-property", regex: /`[^`]+`/g },
    { className: "syntax-string", regex: /\[[^\]]+\]\([^)]+\)/g },
    { className: "syntax-keyword", regex: /(?:\*\*|__)[^*_]+(?:\*\*|__)/g }
  ]);
}

function highlightShell(source: string): HighlightToken[] {
  return highlightPattern(source, shellPatterns);
}

function highlightPattern(source: string, patterns: TokenPattern[]): HighlightToken[] {
  const matches: HighlightTokenMatch[] = [];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern.regex)) {
      if (match.index === undefined || match[0].length === 0) {
        continue;
      }

      matches.push({
        className: pattern.className,
        start: match.index,
        end: match.index + match[0].length
      });
    }
  }

  matches.sort((left, right) => left.start - right.start || right.end - left.end);
  const tokens: HighlightToken[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) {
      continue;
    }

    if (match.start > cursor) {
      tokens.push({ className: "", text: source.slice(cursor, match.start) });
    }

    tokens.push({ className: match.className, text: source.slice(match.start, match.end) });
    cursor = match.end;
  }

  if (cursor < source.length) {
    tokens.push({ className: "", text: source.slice(cursor) });
  }

  return tokens;
}

function splitWithPattern(source: string, pattern: TokenPattern): HighlightToken[] {
  return highlightPattern(source, [pattern]);
}

interface HighlightTokenMatch {
  className: string;
  start: number;
  end: number;
}

function renderTokens(tokens: HighlightToken[]): ReactElement[] {
  return tokens.map((token, index) => (
    <span className={token.className || undefined} key={`${index}-${token.text}`}>
      {token.text}
    </span>
  ));
}
