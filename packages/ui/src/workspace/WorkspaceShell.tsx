import type { ReactElement } from "react";

import type { Slice, Workstream, WorkstreamOverviewResponse, WorkspaceResponse } from "../types";
import { countsForSlice, countsForWorkstream, dependencyLabels } from "./workspace-model";
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
  const selectedWorkstream = workspace?.workstreams.find((workstream) => workstream.id === selectedWorkstreamId);
  const selectedSlice = overview?.slices.find((slice) => slice.id === selectedSliceId);
  const activeWorkstreamId = workspace?.activeWorkstream?.id;
  const activeSliceId = workspace?.activeSlice?.id;

  return (
    <main className="workspace-app">
      <aside className="workspace-rail">
        <ProjectNav
          workspace={workspace}
          selectedWorkstreamId={selectedWorkstreamId}
          activeWorkstreamId={activeWorkstreamId}
          onSelectWorkstream={onSelectWorkstream}
        />
      </aside>
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
        <Inspector
          loading={loading}
          error={error}
          overview={overview}
          selectedWorkstream={selectedWorkstream}
          selectedSlice={selectedSlice}
          activeSliceId={activeSliceId}
          statusMessage={statusMessage}
          onMakeActive={onMakeActive}
        />
      </aside>
    </main>
  );
}

function ProjectNav({
  workspace,
  selectedWorkstreamId,
  activeWorkstreamId,
  onSelectWorkstream
}: {
  workspace?: WorkspaceResponse;
  selectedWorkstreamId?: string;
  activeWorkstreamId?: string;
  onSelectWorkstream: (workstreamId: string) => void;
}): ReactElement {
  return (
    <div className="rail-content">
      <div className="repo-block">
        <div className="eyebrow">Current repository</div>
        <h1>{workspace?.project.name || "Pathfinder workspace"}</h1>
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

function Inspector({
  loading,
  error,
  overview,
  selectedWorkstream,
  selectedSlice,
  activeSliceId,
  statusMessage,
  onMakeActive
}: {
  loading: boolean;
  error?: string;
  overview?: WorkstreamOverviewResponse;
  selectedWorkstream?: Workstream;
  selectedSlice?: Slice;
  activeSliceId?: string;
  statusMessage?: string;
  onMakeActive: () => void;
}): ReactElement {
  if (loading) {
    return <InspectorEmpty title="Inspector" message="Loading details." />;
  }

  if (error) {
    return <InspectorEmpty title="Inspector" message="Workspace details are unavailable." />;
  }

  if (!selectedWorkstream || !overview) {
    return <InspectorEmpty title="Inspector" message="Select a workstream to inspect its state." />;
  }

  if (!selectedSlice) {
    const counts = countsForWorkstream(overview);
    return (
      <div className="inspector-content">
        <div className="inspector-heading">
          <div className="eyebrow">Selected workstream</div>
          <h2>{selectedWorkstream.title}</h2>
          <p>{selectedWorkstream.id}</p>
        </div>
        <InspectorCounts counts={counts} />
        {statusMessage ? <p className="status-text">{statusMessage}</p> : null}
      </div>
    );
  }

  const counts = countsForSlice(selectedSlice, overview.comments, overview.reviewSessions, overview.evidence);
  const dependencies = dependencyLabels(selectedSlice, overview.slices);
  const isActive = selectedSlice.id === activeSliceId;

  return (
    <div className="inspector-content">
      <div className="inspector-heading">
        <div className="eyebrow">Selected slice</div>
        <h2>{selectedSlice.title}</h2>
        <p>{selectedSlice.id}</p>
      </div>
      <div className="inspector-actions">
        <StatusPill status={selectedSlice.status} />
        <button
          className="button button-primary"
          type="button"
          disabled={isActive}
          onClick={onMakeActive}
        >
          {isActive ? "Active" : "Make active"}
        </button>
      </div>
      <p className="inspector-description">{selectedSlice.description || "No description recorded."}</p>
      <DetailList
        items={[
          ["Dependencies", dependencies.length > 0 ? dependencies.join(", ") : "None"],
          ["Branch", selectedSlice.branchName || "Not started"],
          ["Base", selectedSlice.baseRef || "Not recorded"]
        ]}
      />
      <InspectorCounts counts={counts} />
      {statusMessage ? <p className="status-text">{statusMessage}</p> : null}
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

function InspectorCounts({ counts }: { counts: { openCommentCount: number; reviewSessionCount: number; evidenceCount: number } }): ReactElement {
  return (
    <div className="inspector-counts">
      <Metric label="Open comments" value={counts.openCommentCount} />
      <Metric label="Review sessions" value={counts.reviewSessionCount} />
      <Metric label="Evidence" value={counts.evidenceCount} />
    </div>
  );
}

function DetailList({ items }: { items: [string, string][] }): ReactElement {
  return (
    <dl className="detail-list">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatusPill({ status }: { status: Slice["status"] }): ReactElement {
  return <span className={`slice-status slice-status-${status}`}>{status.replace("_", " ")}</span>;
}

function EmptyState({ title, message }: { title: string; message: string }): ReactElement {
  return (
    <div className="empty workspace-empty">
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

function InspectorEmpty({ title, message }: { title: string; message: string }): ReactElement {
  return (
    <div className="inspector-content">
      <div className="inspector-heading">
        <div className="eyebrow">{title}</div>
        <p>{message}</p>
      </div>
    </div>
  );
}
