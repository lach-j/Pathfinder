import type { Node, Edge } from "@xyflow/react";
import type { ReactElement } from "react";

import type {
  ReviewComment,
  ReviewSession,
  Slice,
  Workstream,
  WorkstreamOverviewResponse,
  WorkspaceResponse
} from "../types";

export type ArtifactTab =
  | "details"
  | "review"
  | "requirements"
  | "plan"
  | "evidence"
  | "feedback"
  | "pr";

export interface ArtifactPreviewPanelProps {
  loading: boolean;
  error?: string;
  overview?: WorkstreamOverviewResponse;
  selectedWorkstream?: Workstream;
  selectedSlice?: Slice;
  activeSliceId?: string;
  statusMessage?: string;
  sliceReviewMode?: boolean;
  onMakeActive: () => void;
  onSelectTab?: (tab: ArtifactTab) => void;
}

export interface WorkspaceReviewPanelProps {
  workstream: Workstream;
  selectedSlice?: Slice;
  sessions: ReviewSession[];
  comments: ReviewComment[];
}

export interface SliceDependencyCanvasProps {
  overview: WorkstreamOverviewResponse;
  activeSliceId?: string;
  selectedSliceId?: string;
  onSelectSlice: (sliceId: string) => void;
}

export interface SliceNodeData extends Record<string, unknown> {
  slice: Slice;
  isActive: boolean;
  isSelected: boolean;
  openCommentCount: number;
  reviewSessionCount: number;
  evidenceCount: number;
}

export interface SliceGraph {
  nodes: Node<SliceNodeData>[];
  edges: Edge[];
  warnings: string[];
}

export interface WorkspaceShellProps {
  workspace?: WorkspaceResponse;
  overview?: WorkstreamOverviewResponse;
  selectedWorkstreamId?: string;
  selectedSliceId?: string;
  loading: boolean;
  error?: string;
  statusMessage?: string;
  initialMode?: "workstreams" | "branch-review";
  renderBranchReview?: () => ReactElement;
  onSelectWorkstream: (workstreamId: string) => void;
  onSelectSlice: (sliceId: string) => void;
  onMakeActive: () => void;
}
