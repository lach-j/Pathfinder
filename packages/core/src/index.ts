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
  requirementsMarkdown?: string;
  planMarkdown: string;
  slices: Slice[];
  comments: ReviewComment[];
  reviews: Review[];
  evidence?: Evidence[];
  repositorySummary?: RepositorySummary;
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
  const slices = sortSlices(input.slices);
  const completedSlices = slices.filter((slice) => slice.status === "complete");
  const remainingSlices = slices.filter((slice) => slice.status !== "complete");
  const evidence = sortEvidence(input.evidence ?? []);
  const reviews = sortReviews(input.reviews);
  const openComments = sortComments(input.comments.filter((comment) => !comment.resolved));
  const resolvedComments = sortComments(input.comments.filter((comment) => comment.resolved));

  const lines = [
    "## Summary",
    "",
    `- Workstream: ${input.workstream.title} (\`${input.workstream.id}\`)`,
    "- Scope: Local Pathfinder PR draft assembled from recorded requirements, plan, slices, evidence, reviews, and comments.",
    "",
    "## Requirements",
    "",
    ...formatMarkdownSection(input.requirementsMarkdown ?? "", "requirements"),
    "",
    "## Plan",
    "",
    ...formatMarkdownSection(input.planMarkdown, "plan"),
    "",
    "## Completed Slices",
    "",
    ...formatCompletedSlices(completedSlices),
    "",
    "## Remaining Slices",
    "",
    ...formatRemainingSlices(remainingSlices),
    "",
    "## Changed Files",
    "",
    ...formatChangedFiles(input.repositorySummary),
    "",
    "## Testing Evidence",
    "",
    ...formatTestingEvidence(evidence, reviews, slices),
    "",
    "## Review Notes",
    "",
    ...formatReviewNotes(reviews, openComments, resolvedComments),
    "",
    "## Risks",
    "",
    ...formatRisks(openComments, reviews),
    "",
    "## Checklist",
    "",
    "- [ ] Requirements reviewed",
    "- [ ] Plan reviewed",
    "- [ ] Completed slices verified",
    "- [ ] Testing evidence reviewed",
    "- [ ] Open review comments resolved or accepted",
    "- [ ] Changed files reviewed against slice scope",
    ""
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

function sortSlices(slices: Slice[]): Slice[] {
  return [...slices].sort((left, right) => {
    const createdComparison = left.createdAt.localeCompare(right.createdAt);
    return createdComparison === 0 ? left.id.localeCompare(right.id) : createdComparison;
  });
}

function sortComments(comments: ReviewComment[]): ReviewComment[] {
  return [...comments].sort((left, right) => {
    const createdComparison = left.createdAt.localeCompare(right.createdAt);
    return createdComparison === 0 ? left.id.localeCompare(right.id) : createdComparison;
  });
}

function sortReviews(reviews: Review[]): Review[] {
  return [...reviews].sort((left, right) => {
    const createdComparison = left.createdAt.localeCompare(right.createdAt);
    return createdComparison === 0 ? left.id.localeCompare(right.id) : createdComparison;
  });
}

function sortEvidence(evidence: Evidence[]): Evidence[] {
  return [...evidence].sort((left, right) => {
    const createdComparison = left.createdAt.localeCompare(right.createdAt);
    return createdComparison === 0 ? left.id.localeCompare(right.id) : createdComparison;
  });
}

function formatMarkdownSection(markdown: string, label: string): string[] {
  const trimmed = markdown.trim();

  if (!trimmed) {
    return [`- No ${label} recorded.`];
  }

  const excerptLength = 700;
  const excerpt =
    trimmed.length > excerptLength ? `${trimmed.slice(0, excerptLength).trimEnd()}...` : trimmed;

  return ["```markdown", excerpt, "```"];
}

function formatCompletedSlices(slices: Slice[]): string[] {
  if (slices.length === 0) {
    return ["- No completed slices recorded."];
  }

  return slices.map(formatSliceForPr);
}

function formatRemainingSlices(slices: Slice[]): string[] {
  if (slices.length === 0) {
    return ["- No remaining slices recorded."];
  }

  return slices.map(formatSliceForPr);
}

function formatSliceForPr(slice: Slice): string {
  const dependencies = slice.dependsOnSliceIds?.length
    ? ` Dependencies: ${slice.dependsOnSliceIds.map((dependency) => `\`${dependency}\``).join(", ")}.`
    : " Dependencies: none.";

  return `- ${slice.title} (\`${slice.id}\`, ${slice.status}): ${slice.description}${dependencies}`;
}

function formatChangedFiles(summary: RepositorySummary | undefined): string[] {
  if (!summary) {
    return ["- No repository summary requested. Re-run with `--base <base-ref>` to include committed changes."];
  }

  const counts = countRepositoryCategories(summary.files);
  const lines = [
    `- Base ref: \`${summary.baseRef}\``,
    `- Head ref: \`${summary.headRef}\``,
    `- Head commit: \`${summary.headCommit}\``,
    `- Merge base: \`${summary.mergeBase}\``,
    `- Changed files: ${summary.files.length} (source ${counts.source}, test ${counts.test}, documentation ${counts.documentation}, configuration ${counts.configuration}, state ${counts.state}, other ${counts.other})`
  ];

  if (summary.files.length === 0) {
    lines.push("- No committed file changes found.");
    return lines;
  }

  const files = [...summary.files].sort((left, right) => {
    const leftPath = left.previousPath ? `${left.previousPath} -> ${left.path}` : left.path;
    const rightPath = right.previousPath ? `${right.previousPath} -> ${right.path}` : right.path;
    if (leftPath < rightPath) {
      return -1;
    }

    if (leftPath > rightPath) {
      return 1;
    }

    return 0;
  });

  for (const file of files) {
    const pathText = file.previousPath ? `${file.previousPath} -> ${file.path}` : file.path;
    lines.push(`- ${formatRepositoryStatus(file.status)} ${file.category}: ${pathText}`);
  }

  return lines;
}

function formatTestingEvidence(evidence: Evidence[], reviews: Review[], slices: Slice[]): string[] {
  const lines: string[] = [];
  const slicesById = new Map(slices.map((slice) => [slice.id, slice]));
  const evidenceBySlice = groupEvidenceBySlice(evidence);

  if (evidence.length === 0 && reviews.every((review) => review.evidence.length === 0)) {
    return ["- No testing evidence recorded."];
  }

  for (const [sliceId, sliceEvidence] of evidenceBySlice) {
    const slice = slicesById.get(sliceId);
    lines.push(`- Slice \`${sliceId}\`${slice ? ` (${slice.title})` : ""}:`);
    for (const item of sliceEvidence) {
      lines.push(`  - ${formatEvidenceItem(item)}`);
    }
  }

  for (const review of reviews) {
    const reviewEvidence = sortEvidence(review.evidence);
    if (reviewEvidence.length === 0) {
      continue;
    }

    lines.push(`- Review \`${review.id}\` evidence:`);
    for (const item of reviewEvidence) {
      lines.push(`  - ${formatEvidenceItem(item)}`);
    }
  }

  return lines;
}

function groupEvidenceBySlice(evidence: Evidence[]): Array<[string, Evidence[]]> {
  const grouped = new Map<string, Evidence[]>();

  for (const item of evidence) {
    grouped.set(item.sliceId, [...(grouped.get(item.sliceId) ?? []), item]);
  }

  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function formatEvidenceItem(evidence: Evidence): string {
  const pathText = evidence.path ? ` (${evidence.path})` : "";
  return `\`${evidence.id}\` [${evidence.kind}]: ${evidence.description}${pathText}`;
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
      for (const check of review.checks ?? []) {
        lines.push(`  - [${check.severity}] ${check.message}`);
      }
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

function formatRisks(openComments: ReviewComment[], reviews: Review[]): string[] {
  const warningCount = reviews.reduce(
    (total, review) => total + (review.checks ?? []).filter((check) => check.severity === "warning").length,
    0
  );

  if (openComments.length === 0 && warningCount === 0) {
    return ["- No unresolved comments or deterministic review warnings recorded."];
  }

  const lines: string[] = [];

  if (openComments.length > 0) {
    lines.push(`- ${openComments.length} unresolved review comment(s) remain.`);
  }

  if (warningCount > 0) {
    lines.push(`- ${warningCount} deterministic review warning(s) recorded.`);
  }

  return lines;
}

function formatRepositoryStatus(status: RepositoryChangeStatus): string {
  if (status === "added") {
    return "A";
  }

  if (status === "modified") {
    return "M";
  }

  if (status === "deleted") {
    return "D";
  }

  if (status === "renamed") {
    return "R";
  }

  if (status === "copied") {
    return "C";
  }

  return "?";
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
