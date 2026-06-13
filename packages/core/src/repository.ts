import { RepositoryFileCategory, RepositorySummaryFile } from "./domain.js";

export function categorizeRepositoryPath(filePath: string): RepositoryFileCategory {
  const normalized = filePath.replace(/\\/g, "/");
  const lower = normalized.toLowerCase();
  const segments = lower.split("/");
  const fileName = segments.at(-1) ?? lower;

  if (segments.includes(".pathfinder")) {
    return "state";
  }

  if (
    segments.includes("test") ||
    segments.includes("tests") ||
    segments.includes("__tests__") ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(fileName)
  ) {
    return "test";
  }

  if (
    segments.includes("docs") ||
    fileName === "readme.md" ||
    fileName === "changelog.md" ||
    fileName === "license" ||
    fileName.endsWith(".md") ||
    fileName.endsWith(".mdx") ||
    fileName.endsWith(".txt")
  ) {
    return "documentation";
  }

  if (
    fileName === "package.json" ||
    fileName === "package-lock.json" ||
    fileName === "tsconfig.json" ||
    fileName.endsWith(".config.js") ||
    fileName.endsWith(".config.cjs") ||
    fileName.endsWith(".config.mjs") ||
    fileName.endsWith(".config.ts") ||
    fileName.endsWith(".json") ||
    fileName.endsWith(".yml") ||
    fileName.endsWith(".yaml") ||
    fileName.startsWith(".")
  ) {
    return "configuration";
  }

  if (/\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|c|cc|cpp|h|hpp|cs|rb|php|swift|kt)$/.test(fileName)) {
    return "source";
  }

  return "other";
}

export function countRepositoryCategories(files: RepositorySummaryFile[]): Record<RepositoryFileCategory, number> {
  return files.reduce<Record<RepositoryFileCategory, number>>(
    (counts, file) => ({
      ...counts,
      [file.category]: counts[file.category] + 1
    }),
    {
      test: 0,
      documentation: 0,
      source: 0,
      configuration: 0,
      state: 0,
      other: 0
    }
  );
}
