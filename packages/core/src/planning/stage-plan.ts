import { ImportedStagePlan, ImportedStagePlanStage } from "../domain.js";
import { PathfinderError } from "../errors.js";
import { assertNonEmptyText } from "../validation.js";

export function parseStagePlanMarkdown(markdown: string): ImportedStagePlan {
  assertNonEmptyText(markdown, "Stage plan markdown");
  const source = markdown;
  const titleMatch = source.match(/^#\s+(.+?)\s*$/m);

  if (!titleMatch) {
    throw new PathfinderError("Could not import stage plan: missing top-level '# <title>' heading.");
  }

  const workstreamTitle = normalizeStagePlanTitle(titleMatch[1]);
  const headingMatches = [...source.matchAll(/^## Stage\s+(\d+):\s+(.+?)\s*$/gm)];

  if (headingMatches.length === 0) {
    throw new PathfinderError("Could not import stage plan: no '## Stage N:' sections were found.");
  }

  const seenStageNumbers = new Set<number>();
  const stages = headingMatches.map((match, index): ImportedStagePlanStage => {
    const fullMatch = match[0];
    const stageNumber = Number.parseInt(match[1], 10);
    const rawTitle = match[2].trim();
    const bodyStart = (match.index ?? 0) + fullMatch.length;
    const bodyEnd = headingMatches[index + 1]?.index ?? source.length;
    const body = source.slice(bodyStart, bodyEnd).trim();

    if (seenStageNumbers.has(stageNumber)) {
      throw new PathfinderError(`Could not import stage plan: duplicate stage number ${stageNumber}.`);
    }

    seenStageNumbers.add(stageNumber);

    const title = normalizeStageTitle(rawTitle);
    if (!title) {
      throw new PathfinderError(`Could not import stage plan: stage ${stageNumber} is missing a title.`);
    }

    if (!body) {
      throw new PathfinderError(`Could not import stage plan: stage ${stageNumber} is missing details.`);
    }

    return {
      stageNumber,
      title,
      heading: fullMatch,
      description: [`${fullMatch}`, "", body].join("\n")
    };
  });

  return {
    workstreamTitle,
    markdown: source,
    stages: stages.sort((left, right) => left.stageNumber - right.stageNumber)
  };
}

function normalizeStagePlanTitle(title: string): string {
  return assertNonEmptyText(title.replace(/\s+-\s+Stage Plan\s*$/i, ""), "Stage plan title");
}

function normalizeStageTitle(title: string): string {
  return title
    .replace(/\s+\[status:\s*[^\]]+\]\s*$/i, "")
    .replace(/\s+\((?:[^()]*)\)\s*$/u, "")
    .trim();
}
