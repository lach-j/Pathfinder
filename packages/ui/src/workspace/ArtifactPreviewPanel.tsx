import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import {
  PanelHeader,
  Tabs
} from "../design-system";
import { loadFeedbackMarkdown } from "./artifact-api";
import { countsForWorkstream } from "./workspace-model";
import type { ArtifactPreviewPanelProps, ArtifactTab } from "./workspace-types";
import {
  DetailsPreview,
  EvidencePreview,
  FeedbackPreview,
  MarkdownPreview,
  PanelEmpty,
} from "./ArtifactPreviewContent";
import { WorkspaceReviewPanel } from "./WorkspaceReviewPanel";
import styles from "./ArtifactPreviewPanel.module.css";

const tabs: { id: ArtifactTab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "review", label: "Review" },
  { id: "requirements", label: "Requirements" },
  { id: "plan", label: "Plan" },
  { id: "evidence", label: "Evidence" },
  { id: "feedback", label: "Feedback" },
  { id: "pr", label: "PR draft" },
];

export function ArtifactPreviewPanel({
  loading,
  error,
  overview,
  selectedWorkstream,
  selectedSlice,
  activeSliceId,
  statusMessage,
  sliceReviewMode = false,
  onMakeActive,
  onSelectTab,
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
          setFeedbackError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load feedback.",
          );
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
    return (
      <PanelEmpty
        title="Artifacts"
        message="Workspace details are unavailable."
      />
    );
  }

  if (!selectedWorkstream || !overview) {
    return (
      <PanelEmpty
        title="Artifacts"
        message="Select a workstream to inspect its state."
      />
    );
  }

  return (
    <div className={`${styles.panel} ${sliceReviewMode ? styles.sliceReviewPanel : ""}`}>
      <PanelHeader
        className={styles.header}
        eyebrow="Artifacts"
        title={selectedSlice ? selectedSlice.title : selectedWorkstream.title}
        description={selectedSlice ? selectedSlice.id : selectedWorkstream.id}
      />

      <Tabs
        className={styles.tabs}
        aria-label="Artifact previews"
        activeId={selectedTab}
        tabs={tabs}
        onSelect={(tabId) => {
          const nextTab = tabId as ArtifactTab;
          setSelectedTab(nextTab);
          onSelectTab?.(nextTab);
        }}
      />

      <div className={styles.body}>
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
          <EvidencePreview
            evidence={overview.evidence}
            selectedSlice={selectedSlice}
          />
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
