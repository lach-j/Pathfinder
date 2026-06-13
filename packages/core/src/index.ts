export type SliceStatus =
  | "proposed"
  | "ready"
  | "in_progress"
  | "review"
  | "complete";

export const sliceStatuses: readonly SliceStatus[] = [
  "proposed",
  "ready",
  "in_progress",
  "review",
  "complete"
];

export type EvidenceKind = "test" | "screenshot" | "log" | "manual" | "benchmark" | "other";

export const evidenceKinds: readonly EvidenceKind[] = [
  "test",
  "screenshot",
  "log",
  "manual",
  "benchmark",
  "other"
];

export type RepositoryFileCategory =
  | "test"
  | "documentation"
  | "source"
  | "configuration"
  | "state"
  | "other";

export const repositoryFileCategories: readonly RepositoryFileCategory[] = [
  "test",
  "documentation",
  "source",
  "configuration",
  "state",
  "other"
];

export type RepositoryChangeStatus = "added" | "modified" | "deleted" | "renamed" | "copied" | "other";

export interface RepositorySummaryFile {
  path: string;
  previousPath?: string;
  status: RepositoryChangeStatus;
  category: RepositoryFileCategory;
}

export interface RepositorySummary {
  baseRef: string;
  headRef: string;
  headCommit: string;
  mergeBase: string;
  files: RepositorySummaryFile[];
}

export interface Project {
  schemaVersion: 1;
  name: string;
  createdAt: string;
  activeWorkstreamId?: string;
}

export interface Workstream {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  activeSliceId?: string;
}

export interface Plan {
  workstreamId: string;
  markdown: string;
}

export interface Slice {
  id: string;
  title: string;
  description: string;
  status: SliceStatus;
  dependsOnSliceIds?: string[];
  branchName?: string;
  baseRef?: string;
  startedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewComment {
  id: string;
  sliceId?: string;
  body: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export interface Review {
  id: string;
  sliceId: string;
  status: "open" | "complete";
  summary: string;
  comments: ReviewComment[];
  evidence: Evidence[];
  checks?: ReviewCheck[];
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  sliceId: string;
  kind: EvidenceKind;
  description: string;
  path?: string;
  createdAt: string;
}

export type ReviewCheckSeverity = "info" | "warning";

export interface ReviewCheck {
  severity: ReviewCheckSeverity;
  message: string;
}

export interface DeterministicReviewInput {
  baseRef: string;
  workstream: Workstream;
  activeSlice: Slice;
  planMarkdown: string;
  requirementsMarkdown: string;
  unresolvedComments: ReviewComment[];
  evidence: Evidence[];
  repositorySummary: RepositorySummary;
}

export interface DeterministicReviewResult {
  status: Review["status"];
  summary: string;
  checks: ReviewCheck[];
}

export interface PrMarkdownInput {
  workstream: Workstream;
  planMarkdown: string;
  slices: Slice[];
  comments: ReviewComment[];
  reviews: Review[];
  evidence?: Evidence[];
}

export class PathfinderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathfinderError";
  }
}

export function isSliceStatus(value: string): value is SliceStatus {
  return sliceStatuses.includes(value as SliceStatus);
}

export function isEvidenceKind(value: string): value is EvidenceKind {
  return evidenceKinds.includes(value as EvidenceKind);
}

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

export function assertNonEmptyText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new PathfinderError(`${label} is required.`);
  }
  return trimmed;
}

export function toUrlSafeId(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (!slug) {
    throw new PathfinderError("Could not create a URL-safe id from the provided text.");
  }

  return slug;
}

export function isUrlSafeId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function nextAvailableId(baseId: string, existingIds: Iterable<string>): string {
  const existing = new Set(existingIds);
  if (!existing.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existing.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

export function createTimestamp(date = new Date()): string {
  return date.toISOString();
}

export function isSliceActionable(slice: Slice, slices: Slice[]): boolean {
  if (slice.status !== "proposed" && slice.status !== "ready") {
    return false;
  }

  const byId = new Map(slices.map((candidate) => [candidate.id, candidate]));
  return (slice.dependsOnSliceIds ?? []).every((dependencyId) => byId.get(dependencyId)?.status === "complete");
}

export function findNextActionableSlice(slices: Slice[]): Slice | undefined {
  return [...slices]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .find((slice) => isSliceActionable(slice, slices));
}

export function generateDeterministicReview(input: DeterministicReviewInput): DeterministicReviewResult {
  const checks: ReviewCheck[] = [
    {
      severity: "info",
      message: `Active slice found: ${input.activeSlice.title} (${input.activeSlice.id}).`
    }
  ];

  if (
    input.activeSlice.status === "in_progress" ||
    input.activeSlice.status === "review" ||
    input.activeSlice.status === "complete"
  ) {
    checks.push({
      severity: "info",
      message: `Active slice status is ${input.activeSlice.status}.`
    });
  } else {
    checks.push({
      severity: "warning",
      message: `Active slice status is ${input.activeSlice.status}; expected in_progress, review, or complete.`
    });
  }

  if (input.repositorySummary.files.length === 0) {
    checks.push({
      severity: "warning",
      message: `No committed diff found against ${input.baseRef}.`
    });
  } else {
    checks.push({
      severity: "info",
      message: `Committed diff against ${input.baseRef} changes ${input.repositorySummary.files.length} file(s).`
    });
  }

  const categoryCounts = countRepositoryCategories(input.repositorySummary.files);
  const implementationFileCount =
    categoryCounts.source + categoryCounts.test + categoryCounts.documentation + categoryCounts.configuration;

  if (implementationFileCount === 0) {
    checks.push({
      severity: "warning",
      message: "No source, test, documentation, or configuration files changed in the committed diff."
    });
  } else {
    checks.push({
      severity: "info",
      message: `Changed categories: source ${categoryCounts.source}, test ${categoryCounts.test}, documentation ${categoryCounts.documentation}, configuration ${categoryCounts.configuration}, state ${categoryCounts.state}, other ${categoryCounts.other}.`
    });
  }

  const sliceComments = input.unresolvedComments.filter(
    (comment) => !comment.sliceId || comment.sliceId === input.activeSlice.id
  );
  if (sliceComments.length === 0) {
    checks.push({
      severity: "info",
      message: "No unresolved comments for the active slice."
    });
  } else {
    checks.push({
      severity: "warning",
      message: `${sliceComments.length} unresolved comment(s) remain for the active slice.`
    });
  }

  if (input.evidence.length === 0) {
    checks.push({
      severity: "warning",
      message: "No evidence recorded for the active slice."
    });
  } else {
    checks.push({
      severity: "info",
      message: `${input.evidence.length} evidence item(s) recorded for the active slice.`
    });
  }

  if (input.planMarkdown.trim()) {
    checks.push({
      severity: "info",
      message: "Plan is recorded."
    });
  } else {
    checks.push({
      severity: "warning",
      message: "Plan is empty."
    });
  }

  if (input.requirementsMarkdown.trim()) {
    checks.push({
      severity: "info",
      message: "Requirements are recorded."
    });
  } else {
    checks.push({
      severity: "warning",
      message: "Requirements are empty."
    });
  }

  const warningCount = checks.filter((check) => check.severity === "warning").length;
  return {
    status: warningCount === 0 ? "complete" : "open",
    summary: `Deterministic review against ${input.baseRef}: ${warningCount} warning(s).`,
    checks
  };
}

export function generatePrMarkdown(input: PrMarkdownInput): string {
  const completedSlices = input.slices.filter((slice) => slice.status === "complete");
  const reviewTestEvidence = input.reviews.flatMap((review) =>
    review.evidence
      .filter((evidence) => evidence.kind === "test")
      .map((evidence) => ({ review, evidence }))
  );
  const sliceTestEvidence = (input.evidence ?? []).filter((evidence) => evidence.kind === "test");
  const openComments = input.comments.filter((comment) => !comment.resolved);
  const resolvedComments = input.comments.filter((comment) => comment.resolved);

  const lines = [
    "## Summary",
    "",
    `- Workstream: ${input.workstream.title} (\`${input.workstream.id}\`)`,
    `- Plan: ${input.planMarkdown.trim() ? "Recorded in Pathfinder." : "No plan recorded."}`,
    "- Scope: Local Pathfinder workstream output assembled from recorded slices, comments, and reviews.",
    "",
    "## Completed Slices",
    "",
    ...formatCompletedSlices(completedSlices),
    "",
    "## Testing",
    "",
    ...formatTesting(reviewTestEvidence, sliceTestEvidence),
    "",
    "## Risks",
    "",
    "- No explicit risks are recorded in Pathfinder state yet.",
    "",
    "## Review Notes",
    "",
    ...formatReviewNotes(input.reviews, openComments, resolvedComments),
    "",
    "## Checklist",
    "",
    "- [ ] Plan reviewed",
    "- [ ] Completed slices verified",
    "- [ ] Tests run or intentionally skipped",
    "- [ ] Open review comments resolved or accepted",
    ""
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

function countRepositoryCategories(files: RepositorySummaryFile[]): Record<RepositoryFileCategory, number> {
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

function formatCompletedSlices(slices: Slice[]): string[] {
  if (slices.length === 0) {
    return ["- No completed slices recorded."];
  }

  return slices.map((slice) => `- ${slice.title} (\`${slice.id}\`): ${slice.description}`);
}

function formatTesting(
  reviewTestEvidence: Array<{ review: Review; evidence: Evidence }>,
  sliceTestEvidence: Evidence[]
): string[] {
  if (reviewTestEvidence.length === 0 && sliceTestEvidence.length === 0) {
    return ["- No testing evidence recorded."];
  }

  const lines = sliceTestEvidence.map((evidence) => {
    const pathText = evidence.path ? ` (${evidence.path})` : "";
    return `- ${evidence.description}${pathText} - slice \`${evidence.sliceId}\``;
  });

  for (const { review, evidence } of reviewTestEvidence) {
    const pathText = evidence.path ? ` (${evidence.path})` : "";
    lines.push(`- ${evidence.description}${pathText} - review \`${review.id}\``);
  }

  return lines;
}

function formatReviewNotes(
  reviews: Review[],
  openComments: ReviewComment[],
  resolvedComments: ReviewComment[]
): string[] {
  const lines: string[] = [];

  if (reviews.length === 0) {
    lines.push("- No review records found.");
  } else {
    for (const review of reviews) {
      lines.push(`- Review \`${review.id}\` (${review.status}, slice \`${review.sliceId}\`): ${review.summary}`);
    }
  }

  if (openComments.length === 0) {
    lines.push("- No open review comments.");
  } else {
    for (const comment of openComments) {
      const sliceText = comment.sliceId ? `slice \`${comment.sliceId}\`` : "workstream";
      lines.push(`- Open comment \`${comment.id}\` (${sliceText}): ${comment.body}`);
    }
  }

  if (resolvedComments.length > 0) {
    for (const comment of resolvedComments) {
      const sliceText = comment.sliceId ? `slice \`${comment.sliceId}\`` : "workstream";
      lines.push(`- Resolved comment \`${comment.id}\` (${sliceText}): ${comment.body}`);
    }
  }

  return lines;
}
