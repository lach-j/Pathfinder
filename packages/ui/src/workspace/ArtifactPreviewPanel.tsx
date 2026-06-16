import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Evidence, Slice, Workstream, WorkstreamOverviewResponse } from "../types";
import { loadFeedbackMarkdown } from "./artifact-api";
import { countsForSlice, countsForWorkstream, dependencyLabels } from "./workspace-model";
import { WorkspaceReviewPanel } from "./WorkspaceReviewPanel";

export type ArtifactTab = "details" | "review" | "requirements" | "plan" | "evidence" | "feedback" | "pr";

const tabs: { id: ArtifactTab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "review", label: "Review" },
  { id: "requirements", label: "Requirements" },
  { id: "plan", label: "Plan" },
  { id: "evidence", label: "Evidence" },
  { id: "feedback", label: "Feedback" },
  { id: "pr", label: "PR draft" }
];

interface ArtifactPreviewPanelProps {
  loading: boolean;
  error?: string;
  overview?: WorkstreamOverviewResponse;
  selectedWorkstream?: Workstream;
  selectedSlice?: Slice;
  activeSliceId?: string;
  statusMessage?: string;
  onMakeActive: () => void;
  onSelectTab?: (tab: ArtifactTab) => void;
}

export function ArtifactPreviewPanel({
  loading,
  error,
  overview,
  selectedWorkstream,
  selectedSlice,
  activeSliceId,
  statusMessage,
  onMakeActive,
  onSelectTab
}: ArtifactPreviewPanelProps): ReactElement {
  const [selectedTab, setSelectedTab] = useState<ArtifactTab>("details");
  const [feedbackMarkdown, setFeedbackMarkdown] = useState<string>();
  const [feedbackError, setFeedbackError] = useState<string>();
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  useEffect(() => {
    setFeedbackMarkdown(undefined);
    setFeedbackError(undefined);
  }, [selectedWorkstream?.id]);

  useEffect(() => {
    onSelectTab?.(selectedTab);
  }, [onSelectTab, selectedTab]);

  useEffect(() => {
    if (selectedTab !== "feedback" || !selectedWorkstream) {
      return;
    }

    let cancelled = false;
    setFeedbackLoading(true);
    setFeedbackError(undefined);

    loadFeedbackMarkdown(selectedWorkstream.id)
      .then((markdown) => {
        if (!cancelled) {
          setFeedbackMarkdown(markdown);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setFeedbackError(loadError instanceof Error ? loadError.message : "Could not load feedback.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setFeedbackLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTab, selectedWorkstream]);

  if (loading) {
    return <PanelEmpty title="Artifacts" message="Loading details." />;
  }

  if (error) {
    return <PanelEmpty title="Artifacts" message="Workspace details are unavailable." />;
  }

  if (!selectedWorkstream || !overview) {
    return <PanelEmpty title="Artifacts" message="Select a workstream to inspect its state." />;
  }

  return (
    <div className="artifact-panel">
      <div className="artifact-header">
        <div className="eyebrow">Artifacts</div>
        <h2>{selectedSlice ? selectedSlice.title : selectedWorkstream.title}</h2>
        <p>{selectedSlice ? selectedSlice.id : selectedWorkstream.id}</p>
      </div>

      <div className="artifact-tabs" role="tablist" aria-label="Artifact previews">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="artifact-tab"
            role="tab"
            aria-selected={selectedTab === tab.id}
            onClick={() => {
              setSelectedTab(tab.id);
              onSelectTab?.(tab.id);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="artifact-body">
        {selectedTab === "details" ? (
          <DetailsPreview
            overview={overview}
            selectedWorkstream={selectedWorkstream}
            selectedSlice={selectedSlice}
            activeSliceId={activeSliceId}
            statusMessage={statusMessage}
            onMakeActive={onMakeActive}
          />
        ) : null}
        {selectedTab === "review" ? (
          <WorkspaceReviewPanel
            workstream={selectedWorkstream}
            selectedSlice={selectedSlice}
            sessions={overview.reviewSessions}
            comments={overview.comments}
          />
        ) : null}
        {selectedTab === "requirements" ? (
          <MarkdownPreview
            markdown={overview.requirements.markdown}
            emptyTitle="No requirements"
            emptyMessage="No requirements markdown is stored for this workstream."
          />
        ) : null}
        {selectedTab === "plan" ? (
          <MarkdownPreview
            markdown={overview.plan.markdown}
            emptyTitle="No plan"
            emptyMessage="No plan markdown is stored for this workstream."
          />
        ) : null}
        {selectedTab === "evidence" ? (
          <EvidencePreview evidence={overview.evidence} selectedSlice={selectedSlice} />
        ) : null}
        {selectedTab === "feedback" ? (
          <FeedbackPreview
            markdown={feedbackMarkdown}
            loading={feedbackLoading}
            error={feedbackError}
            openCommentCount={countsForWorkstream(overview).openCommentCount}
          />
        ) : null}
        {selectedTab === "pr" ? (
          <MarkdownPreview
            markdown={overview.prDraft.markdown}
            emptyTitle="No stored PR draft"
            emptyMessage={`Create or update the stored PR draft with the agent or CLI: pathfinder pr generate ${selectedWorkstream.id}`}
          />
        ) : null}
      </div>
    </div>
  );
}

function DetailsPreview({
  overview,
  selectedWorkstream,
  selectedSlice,
  activeSliceId,
  statusMessage,
  onMakeActive
}: {
  overview: WorkstreamOverviewResponse;
  selectedWorkstream: Workstream;
  selectedSlice?: Slice;
  activeSliceId?: string;
  statusMessage?: string;
  onMakeActive: () => void;
}): ReactElement {
  if (!selectedSlice) {
    return (
      <div className="artifact-section">
        <div className="artifact-heading">
          <div className="eyebrow">Selected workstream</div>
          <h3>{selectedWorkstream.title}</h3>
          <p>{selectedWorkstream.id}</p>
        </div>
        <InspectorCounts counts={countsForWorkstream(overview)} />
        {statusMessage ? <p className="status-text">{statusMessage}</p> : null}
      </div>
    );
  }

  const counts = countsForSlice(selectedSlice, overview.comments, overview.reviewSessions, overview.evidence);
  const dependencies = dependencyLabels(selectedSlice, overview.slices);
  const isActive = selectedSlice.id === activeSliceId;

  return (
    <div className="artifact-section">
      <div className="artifact-actions">
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
          ["Base", selectedSlice.baseRef || "Not recorded"],
          ["Created", selectedSlice.createdAt],
          ["Updated", selectedSlice.updatedAt]
        ]}
      />
      <InspectorCounts counts={counts} />
      {statusMessage ? <p className="status-text">{statusMessage}</p> : null}
    </div>
  );
}

function MarkdownPreview({
  markdown,
  emptyTitle,
  emptyMessage
}: {
  markdown: string;
  emptyTitle: string;
  emptyMessage: string;
}): ReactElement {
  if (!markdown.trim()) {
    return <ArtifactEmpty title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className="markdown-preview">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}

function FeedbackPreview({
  markdown,
  loading,
  error,
  openCommentCount
}: {
  markdown?: string;
  loading: boolean;
  error?: string;
  openCommentCount: number;
}): ReactElement {
  if (loading) {
    return <ArtifactEmpty title="Loading feedback" message="Reading the open feedback queue." />;
  }

  if (error) {
    return <ArtifactEmpty title="Feedback unavailable" message={error} />;
  }

  if (openCommentCount === 0) {
    return <ArtifactEmpty title="No open comments" message="There are no open feedback items for this workstream." />;
  }

  return (
    <MarkdownPreview
      markdown={markdown || ""}
      emptyTitle="No feedback"
      emptyMessage="The feedback queue did not return any markdown."
    />
  );
}

function EvidencePreview({
  evidence,
  selectedSlice
}: {
  evidence: Evidence[];
  selectedSlice?: Slice;
}): ReactElement {
  const selectedEvidence = useMemo(
    () => selectedSlice ? evidence.filter((item) => item.sliceId === selectedSlice.id) : [],
    [evidence, selectedSlice]
  );
  const otherEvidence = selectedSlice
    ? evidence.filter((item) => item.sliceId !== selectedSlice.id)
    : evidence;

  if (evidence.length === 0) {
    return <ArtifactEmpty title="No evidence" message="No evidence records are stored for this workstream." />;
  }

  return (
    <div className="evidence-preview">
      {selectedSlice ? (
        <EvidenceGroup
          title="Selected slice evidence"
          emptyMessage="No evidence records are linked to the selected slice."
          evidence={selectedEvidence}
          highlighted
        />
      ) : null}
      <EvidenceGroup
        title={selectedSlice ? "Other workstream evidence" : "Workstream evidence"}
        emptyMessage="No other evidence records are stored for this workstream."
        evidence={otherEvidence}
      />
    </div>
  );
}

function EvidenceGroup({
  title,
  emptyMessage,
  evidence,
  highlighted = false
}: {
  title: string;
  emptyMessage: string;
  evidence: Evidence[];
  highlighted?: boolean;
}): ReactElement {
  return (
    <section className="evidence-group">
      <h3>{title}</h3>
      {evidence.length === 0 ? (
        <p className="muted-copy">{emptyMessage}</p>
      ) : (
        <div className="evidence-list">
          {evidence.map((item) => (
            <article className={`evidence-item${highlighted ? " is-highlighted" : ""}`} key={item.id}>
              <div className="evidence-topline">
                <span>{item.kind}</span>
                <span>{item.sliceId}</span>
              </div>
              <h4>{item.description}</h4>
              <DetailList
                items={[
                  ["ID", item.id],
                  ["Path", item.path || "Not recorded"],
                  ["Created", item.createdAt]
                ]}
              />
            </article>
          ))}
        </div>
      )}
    </section>
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

function Metric({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <div className="metric">
      <span>{value}</span>
      <span>{label}</span>
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

function PanelEmpty({ title, message }: { title: string; message: string }): ReactElement {
  return (
    <div className="artifact-panel">
      <div className="artifact-header">
        <div className="eyebrow">{title}</div>
        <p>{message}</p>
      </div>
    </div>
  );
}

function ArtifactEmpty({ title, message }: { title: string; message: string }): ReactElement {
  return (
    <div className="artifact-empty">
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}
