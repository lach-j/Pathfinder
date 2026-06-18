import { useMemo } from "react";
import type { ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Button,
  EmptyState,
  Metric as DesignMetric,
  PanelHeader,
  StatusChip,
} from "../design-system";
import type {
  Evidence,
  Slice,
  Workstream,
  WorkstreamOverviewResponse,
} from "../types";
import {
  countsForSlice,
  countsForWorkstream,
  dependencyLabels,
} from "./workspace-model";
import styles from "./ArtifactPreviewPanel.module.css";
export function DetailsPreview({
  overview,
  selectedWorkstream,
  selectedSlice,
  activeSliceId,
  statusMessage,
  onMakeActive,
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
      <div className={styles.section}>
        <div className={styles.heading}>
          <div className="eyebrow">Selected workstream</div>
          <h3>{selectedWorkstream.title}</h3>
          <p>{selectedWorkstream.id}</p>
        </div>
        <InspectorCounts counts={countsForWorkstream(overview)} />
        {statusMessage ? <p className="status-text">{statusMessage}</p> : null}
      </div>
    );
  }

  const counts = countsForSlice(
    selectedSlice,
    overview.comments,
    overview.reviewSessions,
    overview.evidence,
  );
  const dependencies = dependencyLabels(selectedSlice, overview.slices);
  const isActive = selectedSlice.id === activeSliceId;

  return (
    <div className={styles.section}>
      <div className={styles.actions}>
        <StatusChip status={selectedSlice.status} />
        <Button
          variant="primary"
          size="sm"
          disabled={isActive}
          onClick={onMakeActive}
        >
          {isActive ? "Active" : "Make active"}
        </Button>
      </div>
      <MarkdownPreview
        emptyMessage=""
        emptyTitle=""
        markdown={selectedSlice.description || "No description recorded."}
      />
      <DetailList
        items={[
          [
            "Dependencies",
            dependencies.length > 0 ? dependencies.join(", ") : "None",
          ],
          ["Branch", selectedSlice.branchName || "Not started"],
          ["Base", selectedSlice.baseRef || "Not recorded"],
          ["Created", selectedSlice.createdAt],
          ["Updated", selectedSlice.updatedAt],
        ]}
      />
      <InspectorCounts counts={counts} />
      {statusMessage ? <p className="status-text">{statusMessage}</p> : null}
    </div>
  );
}

export function MarkdownPreview({
  markdown,
  emptyTitle,
  emptyMessage,
}: {
  markdown: string;
  emptyTitle: string;
  emptyMessage: string;
}): ReactElement {
  if (!markdown.trim()) {
    return <ArtifactEmpty title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className={styles.markdownPreview}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}

export function FeedbackPreview({
  markdown,
  loading,
  error,
  openCommentCount,
}: {
  markdown?: string;
  loading: boolean;
  error?: string;
  openCommentCount: number;
}): ReactElement {
  if (loading) {
    return (
      <ArtifactEmpty
        title="Loading feedback"
        message="Reading the open feedback queue."
      />
    );
  }

  if (error) {
    return <ArtifactEmpty title="Feedback unavailable" message={error} />;
  }

  if (openCommentCount === 0) {
    return (
      <ArtifactEmpty
        title="No open comments"
        message="There are no open feedback items for this workstream."
      />
    );
  }

  return (
    <MarkdownPreview
      markdown={markdown || ""}
      emptyTitle="No feedback"
      emptyMessage="The feedback queue did not return any markdown."
    />
  );
}

export function EvidencePreview({
  evidence,
  selectedSlice,
}: {
  evidence: Evidence[];
  selectedSlice?: Slice;
}): ReactElement {
  const selectedEvidence = useMemo(
    () => selectedSlice ? evidence.filter((item) => item.sliceId === selectedSlice.id) : [],
    [evidence, selectedSlice],
  );
  const otherEvidence = selectedSlice ? evidence.filter((item) => item.sliceId !== selectedSlice.id) : evidence;

  if (evidence.length === 0) {
    return (
      <ArtifactEmpty
        title="No evidence"
        message="No evidence records are stored for this workstream."
      />
    );
  }

  return (
    <div className={styles.evidencePreview}>
      {selectedSlice ? (
        <EvidenceGroup
          title="Selected slice evidence"
          emptyMessage="No evidence records are linked to the selected slice."
          evidence={selectedEvidence}
          highlighted
        />
      ) : null}
      <EvidenceGroup
        title={
          selectedSlice ? "Other workstream evidence" : "Workstream evidence"
        }
        emptyMessage="No other evidence records are stored for this workstream."
        evidence={otherEvidence}
      />
    </div>
  );
}

export function PanelEmpty({
  title,
  message,
}: {
  title: string;
  message: string;
}): ReactElement {
  return (
    <div className={styles.panel}>
      <PanelHeader
        className={styles.header}
        eyebrow={title}
        title="Workspace artifacts"
        description={message}
      />
    </div>
  );
}

function EvidenceGroup({
  title,
  emptyMessage,
  evidence,
  highlighted = false,
}: {
  title: string;
  emptyMessage: string;
  evidence: Evidence[];
  highlighted?: boolean;
}): ReactElement {
  return (
    <section className={styles.evidenceGroup}>
      <h3>{title}</h3>
      {evidence.length === 0 ? (
        <p className={styles.mutedCopy}>{emptyMessage}</p>
      ) : (
        <div className={styles.evidenceList}>
          {evidence.map((item) => (
            <article
              className={`${styles.evidenceItem}${highlighted ? ` ${styles.highlightedEvidence}` : ""}`}
              key={item.id}
            >
              <div className={styles.evidenceTopline}>
                <span>{item.kind}</span>
                <span>{item.sliceId}</span>
              </div>
              <h4>{item.description}</h4>
              <DetailList
                items={[
                  ["ID", item.id],
                  ["Path", item.path || "Not recorded"],
                  ["Created", item.createdAt],
                ]}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function InspectorCounts({
  counts,
}: {
  counts: {
    openCommentCount: number;
    reviewSessionCount: number;
    evidenceCount: number;
  };
}): ReactElement {
  return (
    <div className={styles.counts}>
      <Metric label="Open comments" value={counts.openCommentCount} />
      <Metric label="Review sessions" value={counts.reviewSessionCount} />
      <Metric label="Evidence" value={counts.evidenceCount} />
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}): ReactElement {
  return <DesignMetric label={label} value={value} />;
}

function DetailList({ items }: { items: [string, string][] }): ReactElement {
  return (
    <dl className={styles.detailList}>
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ArtifactEmpty({
  title,
  message,
}: {
  title: string;
  message: string;
}): ReactElement {
  return (
    <EmptyState className={styles.empty} title={title} description={message} />
  );
}
