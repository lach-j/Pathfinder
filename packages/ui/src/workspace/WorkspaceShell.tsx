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
import { ArtifactPreviewPanel } from "./ArtifactPreviewPanel";
import { BranchReviewWorkspace } from "./BranchReviewWorkspace";
import { SliceDependencyCanvas } from "./SliceDependencyCanvas";
import type { ArtifactTab, WorkspaceShellProps } from "./workspace-types";
import styles from "./WorkspaceShell.module.css";

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
        styles.app,
        mode === "branch-review" ? styles.branchReview : "",
        isSliceReviewOpen ? styles.sliceReview : ""
      ].filter(Boolean).join(" ")}
    >
      <Sidebar className={styles.rail} aria-label="Workspace navigation">
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
        <MainSurface className={`${styles.main} ${styles.mainBranch}`}>
          {renderBranchReview ? renderBranchReview() : <BranchReviewWorkspace />}
        </MainSurface>
      ) : (
        <>
          <MainSurface className={styles.main}>
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
          <InspectorPanel className={styles.inspector} aria-label="Workstream artifacts">
            <ArtifactPreviewPanel
              loading={loading}
              error={error}
              overview={overview}
              selectedWorkstream={selectedWorkstream}
              selectedSlice={selectedSlice}
              activeSliceId={activeSliceId}
              statusMessage={statusMessage}
              sliceReviewMode={isSliceReviewOpen}
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
    <div className={styles.railContent}>
      <Panel className={styles.repoBlock} density="compact">
        <PanelHeader
          eyebrow="Current repository"
          title={workspace?.project.name || "Pathfinder workspace"}
          description={workspace ? `${workspace.workstreams.length} workstream${workspace.workstreams.length === 1 ? "" : "s"}` : "Pathfinder state loading"}
          actions={activeWorkstreamId ? <Badge tone="accent">Active set</Badge> : undefined}
        />
      </Panel>
      <div className={styles.railSection}>
        <div className={styles.railHeading}>Review modes</div>
        <div className={styles.workstreamList}>
          <button
            className={`${styles.workstreamButton} ${styles.modeButton}`}
            type="button"
            aria-current={mode === "branch-review"}
            onClick={onSelectBranchReview}
          >
            <span className={styles.workstreamTitle}>Branch review</span>
            <span className={styles.workstreamMeta}>Standalone committed diff review</span>
            <Badge tone={mode === "branch-review" ? "accent" : "neutral"}>Mode</Badge>
          </button>
        </div>
      </div>
      <div className={styles.railSection}>
        <div className={styles.railHeading}>Workstreams</div>
        {!workspace ? (
          <EmptyState
            className={styles.railEmpty}
            title="Loading workstreams"
            description="Reading Pathfinder state for this repository."
          />
        ) : workspace.workstreams.length === 0 ? (
          <EmptyState
            className={styles.railEmpty}
            title="No workstreams"
            description="Create a workstream to populate this workspace."
          />
        ) : (
          <div className={styles.workstreamList}>
            {workspace.workstreams.map((workstream) => (
              <button
                className={styles.workstreamButton}
                type="button"
                key={workstream.id}
                aria-current={workstream.id === selectedWorkstreamId}
                onClick={() => onSelectWorkstream(workstream.id)}
              >
                <span className={styles.workstreamTitle}>{workstream.title}</span>
                <span className={styles.workstreamMeta}>
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
        className={styles.workspaceEmpty}
        title="Loading workspace"
        description="Reading Pathfinder state for the current repository."
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        className={styles.workspaceEmpty}
        title="No Pathfinder workspace"
        description={error}
      />
    );
  }

  if (!workspace) {
    return (
      <EmptyState
        className={styles.workspaceEmpty}
        title="No Pathfinder workspace"
        description="Initialize Pathfinder for this repository to use the workspace."
      />
    );
  }

  if (workspace.workstreams.length === 0) {
    return (
      <EmptyState
        className={styles.workspaceEmpty}
        title="No workstreams"
        description="Create a workstream to populate the workspace."
      />
    );
  }

  if (!selectedWorkstream) {
    return (
      <EmptyState
        className={styles.workspaceEmpty}
        title="Workstream not found"
        description="The selected workstream is no longer available in this repository."
      />
    );
  }

  if (!overview) {
    return (
      <EmptyState
        className={styles.workspaceEmpty}
        title="Loading workstream"
        description="Reading workstream slices and review state."
      />
    );
  }

  const counts = countsForWorkstream(overview);
  const selectedSlice = overview.slices.find((slice) => slice.id === selectedSliceId);
  const activeSlice = overview.slices.find((slice) => slice.id === activeSliceId);

  return (
    <div className={styles.workspaceSurface}>
      <Panel className={styles.surfaceHeader} density="compact">
        <PanelHeader
          eyebrow="Workstream overview"
          title={overview.workstream.title}
          description={overview.workstream.id}
          actions={activeSlice ? <StatusChip status={activeSlice.status} label="Active slice" /> : undefined}
        />
        <div className={styles.surfaceStats} aria-label="Workstream counts">
          <Metric label="Slices" value={overview.slices.length} />
          <Metric label="Open comments" value={counts.openCommentCount} tone={counts.openCommentCount > 0 ? "warning" : "neutral"} />
          <Metric label="Reviews" value={overview.reviewSessions.length} />
        </div>
        {selectedSlice ? (
          <Notice className={styles.selectionNotice} tone="info" title="Selected slice">
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
