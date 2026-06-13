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
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  kind: "test" | "screenshot" | "log" | "manual" | "benchmark" | "other";
  description: string;
  path?: string;
  createdAt: string;
}

export interface PrMarkdownInput {
  workstream: Workstream;
  planMarkdown: string;
  slices: Slice[];
  comments: ReviewComment[];
  reviews: Review[];
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

export function generatePrMarkdown(input: PrMarkdownInput): string {
  const completedSlices = input.slices.filter((slice) => slice.status === "complete");
  const testEvidence = input.reviews.flatMap((review) =>
    review.evidence
      .filter((evidence) => evidence.kind === "test")
      .map((evidence) => ({ review, evidence }))
  );
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
    ...formatTesting(testEvidence),
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

function formatCompletedSlices(slices: Slice[]): string[] {
  if (slices.length === 0) {
    return ["- No completed slices recorded."];
  }

  return slices.map((slice) => `- ${slice.title} (\`${slice.id}\`): ${slice.description}`);
}

function formatTesting(testEvidence: Array<{ review: Review; evidence: Evidence }>): string[] {
  if (testEvidence.length === 0) {
    return ["- No testing evidence recorded."];
  }

  return testEvidence.map(({ review, evidence }) => {
    const pathText = evidence.path ? ` (${evidence.path})` : "";
    return `- ${evidence.description}${pathText} - review \`${review.id}\``;
  });
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
