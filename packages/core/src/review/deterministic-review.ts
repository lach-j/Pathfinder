import { DeterministicReviewInput, DeterministicReviewResult, ReviewCheck } from "../domain.js";
import { countRepositoryCategories } from "../repository.js";

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
