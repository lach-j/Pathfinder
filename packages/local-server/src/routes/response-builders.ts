import { PathfinderError } from "@pathfinder/core";
import type { PathfinderStore } from "@pathfinder/state";

import type {
  BranchReviewOverviewResponse,
  WorkspaceResponse,
  WorkstreamOverviewResponse
} from "../server-types.js";

export async function getWorkspaceResponse(store: PathfinderStore): Promise<WorkspaceResponse> {
  const project = await store.getProject();
  const workstreams = await store.listWorkstreams();
  const activeWorkstream = project.activeWorkstreamId
    ? await store.getWorkstream(project.activeWorkstreamId)
    : undefined;
  const activeSlice = activeWorkstream?.activeSliceId
    ? (await store.listSlices(activeWorkstream.id)).find((slice) => slice.id === activeWorkstream.activeSliceId)
    : undefined;

  if (activeWorkstream?.activeSliceId && !activeSlice) {
    throw new PathfinderError(
      `Active slice '${activeWorkstream.activeSliceId}' was not found in workstream '${activeWorkstream.id}'.`
    );
  }

  return {
    project,
    ...(activeWorkstream ? { activeWorkstream } : {}),
    ...(activeSlice ? { activeSlice } : {}),
    workstreams
  };
}

export async function getWorkstreamOverviewResponse(
  store: PathfinderStore,
  workstreamId: string
): Promise<WorkstreamOverviewResponse> {
  const requirements = await store.getRequirementsDocument(workstreamId);
  const plan = await store.getPlanDocument(workstreamId);
  const prDraft = await store.getStoredPrMarkdown(workstreamId);

  return {
    workstream: await store.getWorkstream(workstreamId),
    requirements,
    plan,
    slices: await store.listSlices(workstreamId),
    comments: await store.listComments(workstreamId),
    reviewSessions: await store.listReviewSessions(workstreamId),
    reviews: await store.listReviews(workstreamId),
    evidence: await store.listEvidence(workstreamId),
    prDraft
  };
}

export async function getBranchReviewOverviewResponse(store: PathfinderStore): Promise<BranchReviewOverviewResponse> {
  const prDraft = await store.getStoredBranchReviewPrMarkdown();

  return {
    sessions: await store.listBranchReviewSessions(),
    comments: await store.listBranchReviewComments(),
    prDraft
  };
}
