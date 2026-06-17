import { useState } from "react";
import type { ReactElement } from "react";

import {
  Badge,
  EmptyState,
  InspectorPanel,
  MainSurface,
  Metric,
  Notice,
  Panel,
  PanelHeader,
  Sidebar,
  StatusChip,
  WorkspaceFrame
} from "../design-system";
import type { Workstream, WorkstreamOverviewResponse, WorkspaceResponse } from "../types";
import { countsForWorkstream } from "./workspace-model";
import { ArtifactPreviewPanel, type ArtifactTab } from "./ArtifactPreviewPanel";
import { BranchReviewWorkspace } from "./BranchReviewWorkspace";
import { SliceDependencyCanvas } from "./SliceDependencyCanvas";

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

export function WorkspaceShell({
  workspace,
  overview,
  selectedWorkstreamId,
  selectedSliceId,
  loading,
  error,
  statusMessage,
  initialMode = "workstreams",
  renderBranchReview,
  onSelectWorkstream,
  onSelectSlice,
  onMakeActive
}: WorkspaceShellProps): ReactElement {
  const [mode, setMode] = useState<"workstreams" | "branch-review">(initialMode);
  const [artifactTab, setArtifactTab] = useState<ArtifactTab>("details");
  const selectedWorkstream = workspace?.workstreams.find((workstream) => workstream.id === selectedWorkstreamId);
  const selectedSlice = overview?.slices.find((slice) => slice.id === selectedSliceId);
  const activeWorkstreamId = workspace?.activeWorkstream?.id;
  const activeSliceId = workspace?.activeSlice?.id;
  const isSliceReviewOpen = mode === "workstreams" && artifactTab === "review";

  return (
    <WorkspaceFrame
      className={[
        "workspace-app",
        mode === "branch-review" ? "is-branch-review" : "",
        isSliceReviewOpen ? "is-slice-review" : ""
      ].filter(Boolean).join(" ")}
    >
      <Sidebar className="workspace-rail" aria-label="Workspace navigation">
        <ProjectNav
          workspace={workspace}
          mode={mode}
          selectedWorkstreamId={selectedWorkstreamId}
          activeWorkstreamId={activeWorkstreamId}
          onSelectBranchReview={() => setMode("branch-review")}
          onSelectWorkstream={(workstreamId) => {
            setMode("workstreams");
            onSelectWorkstream(workstreamId);
          }}
        />
      </Sidebar>
      {mode === "branch-review" ? (
        <MainSurface className="workspace-main workspace-main-branch">
          {renderBranchReview ? renderBranchReview() : <BranchReviewWorkspace />}
        </MainSurface>
      ) : (
        <>
          <MainSurface className="workspace-main">
            <WorkspaceOverview
              loading={loading}
              error={error}
              workspace={workspace}
              overview={overview}
              selectedWorkstream={selectedWorkstream}
              selectedSliceId={selectedSliceId}
              activeSliceId={activeSliceId}
              onSelectSlice={onSelectSlice}
            />
          </MainSurface>
          <InspectorPanel className="workspace-inspector" aria-label="Workstream artifacts">
            <ArtifactPreviewPanel
              loading={loading}
              error={error}
              overview={overview}
              selectedWorkstream={selectedWorkstream}
              selectedSlice={selectedSlice}
              activeSliceId={activeSliceId}
              statusMessage={statusMessage}
              onMakeActive={onMakeActive}
              onSelectTab={setArtifactTab}
            />
          </InspectorPanel>
        </>
      )}
    </WorkspaceFrame>
  );
}

function ProjectNav({
  workspace,
  mode,
  selectedWorkstreamId,
  activeWorkstreamId,
  onSelectBranchReview,
  onSelectWorkstream
}: {
  workspace?: WorkspaceResponse;
  mode: "workstreams" | "branch-review";
  selectedWorkstreamId?: string;
  activeWorkstreamId?: string;
  onSelectBranchReview: () => void;
  onSelectWorkstream: (workstreamId: string) => void;
}): ReactElement {
  return (
    <div className="rail-content">
      <Panel className="repo-block" density="compact">
        <PanelHeader
          eyebrow="Current repository"
          title={workspace?.project.name || "Pathfinder workspace"}
          description={workspace ? `${workspace.workstreams.length} workstream${workspace.workstreams.length === 1 ? "" : "s"}` : "Pathfinder state loading"}
          actions={activeWorkstreamId ? <Badge tone="accent">Active set</Badge> : undefined}
        />
      </Panel>
      <div className="rail-section">
        <div className="rail-heading">Review modes</div>
        <div className="workstream-list">
          <button
            className="workstream-button mode-button"
            type="button"
            aria-current={mode === "branch-review"}
            onClick={onSelectBranchReview}
          >
            <span className="workstream-title">Branch review</span>
            <span className="workstream-meta">Standalone committed diff review</span>
            <Badge tone={mode === "branch-review" ? "accent" : "neutral"}>Mode</Badge>
          </button>
        </div>
      </div>
      <div className="rail-section">
        <div className="rail-heading">Workstreams</div>
        {!workspace ? (
          <EmptyState
            className="rail-empty"
            title="Loading workstreams"
            description="Reading Pathfinder state for this repository."
          />
        ) : workspace.workstreams.length === 0 ? (
          <EmptyState
            className="rail-empty"
            title="No workstreams"
            description="Create a workstream to populate this workspace."
          />
        ) : (
          <div className="workstream-list">
            {workspace.workstreams.map((workstream) => (
              <button
                className="workstream-button"
                type="button"
                key={workstream.id}
                aria-current={workstream.id === selectedWorkstreamId}
                onClick={() => onSelectWorkstream(workstream.id)}
              >
                <span className="workstream-title">{workstream.title}</span>
                <span className="workstream-meta">
                  {workstream.id}
                </span>
                {workstream.id === activeWorkstreamId ? <Badge tone="success">Active</Badge> : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkspaceOverview({
  loading,
  error,
  workspace,
  overview,
  selectedWorkstream,
  selectedSliceId,
  activeSliceId,
  onSelectSlice
}: {
  loading: boolean;
  error?: string;
  workspace?: WorkspaceResponse;
  overview?: WorkstreamOverviewResponse;
  selectedWorkstream?: Workstream;
  selectedSliceId?: string;
  activeSliceId?: string;
  onSelectSlice: (sliceId: string) => void;
}): ReactElement {
  if (loading) {
    return (
      <EmptyState
        className="workspace-empty"
        title="Loading workspace"
        description="Reading Pathfinder state for the current repository."
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        className="workspace-empty"
        title="No Pathfinder workspace"
        description={error}
      />
    );
  }

  if (!workspace) {
    return (
      <EmptyState
        className="workspace-empty"
        title="No Pathfinder workspace"
        description="Initialize Pathfinder for this repository to use the workspace."
      />
    );
  }

  if (workspace.workstreams.length === 0) {
    return (
      <EmptyState
        className="workspace-empty"
        title="No workstreams"
        description="Create a workstream to populate the workspace."
      />
    );
  }

  if (!selectedWorkstream) {
    return (
      <EmptyState
        className="workspace-empty"
        title="Workstream not found"
        description="The selected workstream is no longer available in this repository."
      />
    );
  }

  if (!overview) {
    return (
      <EmptyState
        className="workspace-empty"
        title="Loading workstream"
        description="Reading workstream slices and review state."
      />
    );
  }

  const counts = countsForWorkstream(overview);
  const selectedSlice = overview.slices.find((slice) => slice.id === selectedSliceId);
  const activeSlice = overview.slices.find((slice) => slice.id === activeSliceId);

  return (
    <div className="workspace-surface">
      <Panel className="surface-header" density="compact">
        <PanelHeader
          eyebrow="Workstream overview"
          title={overview.workstream.title}
          description={overview.workstream.id}
          actions={activeSlice ? <StatusChip status={activeSlice.status} label="Active slice" /> : undefined}
        />
        <div className="surface-stats" aria-label="Workstream counts">
          <Metric label="Slices" value={overview.slices.length} />
          <Metric label="Open comments" value={counts.openCommentCount} tone={counts.openCommentCount > 0 ? "warning" : "neutral"} />
          <Metric label="Reviews" value={overview.reviewSessions.length} />
        </div>
        {selectedSlice ? (
          <Notice className="selection-notice" tone="info" title="Selected slice">
            {selectedSlice.title}
          </Notice>
        ) : null}
      </Panel>

      <SliceDependencyCanvas
        overview={overview}
        activeSliceId={activeSliceId}
        selectedSliceId={selectedSliceId}
        onSelectSlice={onSelectSlice}
      />
    </div>
  );
}
