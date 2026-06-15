import type {
  Evidence,
  ReviewComment,
  ReviewSession,
  Slice,
  WorkstreamOverviewResponse
} from "../types";

export interface InspectorCounts {
  openCommentCount: number;
  reviewSessionCount: number;
  evidenceCount: number;
}

export function countsForWorkstream(overview: WorkstreamOverviewResponse | undefined): InspectorCounts {
  return {
    openCommentCount: (overview?.comments || []).filter((comment) => !comment.resolved).length,
    reviewSessionCount: overview?.reviewSessions.length || 0,
    evidenceCount: overview?.evidence.length || 0
  };
}

export function countsForSlice(
  slice: Slice,
  comments: ReviewComment[],
  reviewSessions: ReviewSession[],
  evidence: Evidence[]
): InspectorCounts {
  return {
    openCommentCount: comments.filter((comment) => commentAppliesToSlice(comment, slice.id) && !comment.resolved).length,
    reviewSessionCount: reviewSessions.filter((session) => session.sliceId === slice.id).length,
    evidenceCount: evidence.filter((item) => item.sliceId === slice.id).length
  };
}

export function dependencyLabels(slice: Slice, slices: Slice[]): string[] {
  const dependencies = slice.dependsOnSliceIds || [];
  return dependencies.map((dependencyId) => {
    const dependency = slices.find((candidate) => candidate.id === dependencyId);
    return dependency ? `${dependency.title} (${dependency.id})` : dependencyId;
  });
}

function commentAppliesToSlice(comment: ReviewComment, sliceId: string): boolean {
  if (comment.sliceId === sliceId) {
    return true;
  }

  return comment.target?.type === "slice" && comment.target.sliceId === sliceId;
}
