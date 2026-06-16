import { useState } from "react";
import type { ReactElement } from "react";

import type { Workstream, WorkstreamOverviewResponse, WorkspaceResponse } from "../types";
import { countsForWorkstream } from "./workspace-model";
import { ArtifactPreviewPanel, type ArtifactTab } from "./ArtifactPreviewPanel";
import { BranchReviewWorkspace } from "./BranchReviewWorkspace";
import { SliceDependencyCanvas } from "./SliceDependencyCanvas";

interface WorkspaceShellProps {
  workspace?: WorkspaceResponse;
  overview?: WorkstreamOverviewResponse;
  selectedWorkstreamId?: string;
  selectedSliceId?: string;
  loading: boolean;
  error?: string;
  statusMessage?: string;
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
  onSelectWorkstream,
  onSelectSlice,
  onMakeActive
}: WorkspaceShellProps): ReactElement {
  const [mode, setMode] = useState<"workstreams" | "branch-review">("workstreams");
  const [artifactTab, setArtifactTab] = useState<ArtifactTab>("details");
  const selectedWorkstream = workspace?.workstreams.find((workstream) => workstream.id === selectedWorkstreamId);
  const selectedSlice = overview?.slices.find((slice) => slice.id === selectedSliceId);
  const activeWorkstreamId = workspace?.activeWorkstream?.id;
  const activeSliceId = workspace?.activeSlice?.id;
  const isSliceReviewOpen = mode === "workstreams" && artifactTab === "review";

  return (
    <main
      className={[
        "workspace-app",
        mode === "branch-review" ? "is-branch-review" : "",
        isSliceReviewOpen ? "is-slice-review" : ""
      ].filter(Boolean).join(" ")}
    >
      <aside className="workspace-rail">
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
      </aside>
      {mode === "branch-review" ? (
        <section className="workspace-main workspace-main-branch">
          <BranchReviewWorkspace />
        </section>
      ) : (
        <>
          <section className="workspace-main">
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
          </section>
          <aside className="workspace-inspector">
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
          </aside>
        </>
      )}
    </main>
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
      <div className="repo-block">
        <div className="eyebrow">Current repository</div>
        <h1>{workspace?.project.name || "Pathfinder workspace"}</h1>
      </div>
      <div className="rail-section">
        <div className="rail-heading">Review modes</div>
        <div className="workstream-list">
          <button
            className="workstream-button"
            type="button"
            aria-current={mode === "branch-review"}
            onClick={onSelectBranchReview}
          >
            <span className="workstream-title">Branch review</span>
            <span className="workstream-meta">Standalone diff review</span>
          </button>
        </div>
      </div>
      <div className="rail-section">
        <div className="rail-heading">Workstreams</div>
        {!workspace ? (
          <p className="muted-copy">Pathfinder state is not loaded.</p>
        ) : workspace.workstreams.length === 0 ? (
          <p className="muted-copy">No workstreams have been created for this repository.</p>
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
                  {workstream.id === activeWorkstreamId ? " · active" : ""}
                </span>
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
    return <EmptyState title="Loading workspace" message="Reading Pathfinder state for the current repository." />;
  }

  if (error) {
    return <EmptyState title="No Pathfinder workspace" message={error} />;
  }

  if (!workspace) {
    return <EmptyState title="No Pathfinder workspace" message="Initialize Pathfinder for this repository to use the workspace." />;
  }

  if (workspace.workstreams.length === 0) {
    return <EmptyState title="No workstreams" message="Create a workstream to populate the workspace." />;
  }

  if (!selectedWorkstream) {
    return <EmptyState title="Workstream not found" message="The selected workstream is no longer available in this repository." />;
  }

  if (!overview) {
    return <EmptyState title="Loading workstream" message="Reading workstream slices and review state." />;
  }

  return (
    <div className="workspace-surface">
      <div className="surface-header">
        <div>
          <div className="eyebrow">Workstream overview</div>
          <h2>{overview.workstream.title}</h2>
          <p>{overview.workstream.id}</p>
        </div>
        <div className="surface-stats" aria-label="Workstream counts">
          <Metric label="Slices" value={overview.slices.length} />
          <Metric label="Open comments" value={countsForWorkstream(overview).openCommentCount} />
          <Metric label="Reviews" value={overview.reviewSessions.length} />
        </div>
      </div>

      <SliceDependencyCanvas
        overview={overview}
        activeSliceId={activeSliceId}
        selectedSliceId={selectedSliceId}
        onSelectSlice={onSelectSlice}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <div className="metric">
      <span>{value}</span>
      <span>{label}</span>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }): ReactElement {
  return (
    <div className="empty workspace-empty">
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}
