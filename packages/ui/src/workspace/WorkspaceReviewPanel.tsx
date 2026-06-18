import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";

import { DiffPane } from "../review/DiffPane";
import { FileList } from "../review/FileList";
import { firstFilePath } from "../review/review-model";
import type {
  CommentFilter,
  DiffFile,
  DiffLine,
  DraftTarget,
  ReviewComment,
  ReviewSession,
  Slice,
  StructuredDiff
} from "../types";
import {
  addWorkstreamReviewComment,
  loadWorkstreamReviewDiff,
  refreshWorkstreamReviewSession,
  resolveWorkstreamReviewComment
} from "./workstream-review-api";
import {
  latestSessionByCreation,
  lineCommentTarget,
  ReviewSessionList,
  ReviewToolbar
} from "./ReviewWorkspaceParts";
import type { WorkspaceReviewPanelProps } from "./workspace-types";

export function WorkspaceReviewPanel({
  workstream,
  selectedSlice,
  sessions,
  comments
}: WorkspaceReviewPanelProps): ReactElement {
  const sliceSessions = useMemo(
    () => selectedSlice
      ? sessions.filter((session) => session.sliceId === selectedSlice.id)
      : [],
    [selectedSlice, sessions]
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const [session, setSession] = useState<ReviewSession>();
  const [diff, setDiff] = useState<StructuredDiff>();
  const [selectedPath, setSelectedPath] = useState<string>();
  const [commentFilter, setCommentFilter] = useState<CommentFilter>("open");
  const [draftTarget, setDraftTarget] = useState<DraftTarget>();
  const [localComments, setLocalComments] = useState<ReviewComment[]>(comments);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    setLocalComments(comments);
  }, [comments]);

  useEffect(() => {
    const latestSession = latestSessionByCreation(sliceSessions);
    setSelectedSessionId((existing) =>
      existing && sliceSessions.some((candidate) => candidate.id === existing)
        ? existing
        : latestSession?.id
    );
    setStatusMessage("");
  }, [selectedSlice?.id, sliceSessions]);

  const loadDiff = useCallback(async (sessionId: string) => {
    setDiffLoading(true);
    setError(undefined);
    try {
      const response = await loadWorkstreamReviewDiff(workstream.id, sessionId);
      setSession(response.session);
      setDiff(response.diff);
      setSelectedPath(firstFilePath(response.diff));
      setDraftTarget(undefined);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load review diff.");
      setSession(undefined);
      setDiff(undefined);
      setSelectedPath(undefined);
    } finally {
      setDiffLoading(false);
    }
  }, [workstream.id]);

  useEffect(() => {
    if (selectedSessionId) {
      void loadDiff(selectedSessionId);
    } else {
      setSession(undefined);
      setDiff(undefined);
      setSelectedPath(undefined);
      setDraftTarget(undefined);
    }
  }, [loadDiff, selectedSessionId]);

  const sessionComments = useMemo(
    () => localComments.filter((comment) => {
      const target = comment.target;
      return selectedSessionId &&
        (target?.type === "file" || target?.type === "line") &&
        target.sessionId === selectedSessionId;
    }),
    [localComments, selectedSessionId]
  );

  async function refreshSelectedSession(): Promise<void> {
    if (!selectedSessionId) {
      return;
    }

    setStatusMessage("Refreshing review session...");
    try {
      const response = await refreshWorkstreamReviewSession(workstream.id, selectedSessionId);
      setSession(response.session);
      setDiff(response.diff);
      setSelectedPath((existing) =>
        existing && response.diff.files.some((file) => file.path === existing) ? existing : firstFilePath(response.diff)
      );
      setLocalComments(response.comments);
      setStatusMessage("Review refreshed.");
    } catch (refreshError) {
      setStatusMessage(refreshError instanceof Error ? refreshError.message : "Could not refresh review.");
    }
  }

  async function saveComment(body: string): Promise<void> {
    if (!draftTarget) {
      return;
    }

    try {
      const response = await addWorkstreamReviewComment(workstream.id, draftTarget, body);
      setLocalComments((existing) => [...existing, response.comment]);
      setDraftTarget(undefined);
      setStatusMessage("Comment saved.");
    } catch (saveError) {
      setStatusMessage(saveError instanceof Error ? saveError.message : "Could not save comment.");
    }
  }

  async function resolveComment(commentId: string): Promise<void> {
    try {
      const response = await resolveWorkstreamReviewComment(workstream.id, commentId);
      setLocalComments((existing) =>
        existing.map((comment) => comment.id === response.comment.id ? response.comment : comment)
      );
      setStatusMessage("Comment resolved.");
    } catch (resolveError) {
      setStatusMessage(resolveError instanceof Error ? resolveError.message : "Could not resolve comment.");
    }
  }

  const emptyState = getDiffEmptyState(Boolean(selectedSlice), sliceSessions, selectedSessionId, diffLoading, error);

  return (
    <div className="slice-review-panel">
      <div className="slice-review-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">Slice reviews</div>
          <div className="sidebar-meta">
            {sliceSessions.length} session{sliceSessions.length === 1 ? "" : "s"}
          </div>
        </div>
        <ReviewSessionList
          sessions={sliceSessions}
          selectedSessionId={selectedSessionId}
          comments={localComments}
          emptyTitle="No slice review sessions"
          emptyMessage="Commit the slice changes, then start a review session:"
          emptyCommand="pathfinder review start --base <base-ref>"
          approvedSeparator=" - "
          onSelectSession={(sessionId) => {
            setSelectedSessionId(sessionId);
            setStatusMessage("");
          }}
        />
        {diff?.files.length ? (
          <FileList
            comments={sessionComments}
            files={diff.files}
            selectedPath={selectedPath}
            onSelectFile={setSelectedPath}
          />
        ) : null}
      </div>

      <section className="slice-review-main">
        <ReviewToolbar
          eyebrow="Pathfinder Slice Review"
          title={selectedSlice ? selectedSlice.title : "No slice selected"}
          description={session ? `${session.id} - ${session.baseRef} to ${session.headRef}` : "No review session selected"}
          comments={sessionComments}
          session={session}
          commentFilter={commentFilter}
          commentFilterId="slice-comment-filter"
          className="slice-review-toolbar"
          onChangeCommentFilter={setCommentFilter}
          onRefresh={() => {
            void refreshSelectedSession();
          }}
        />
        <DiffPane
          diff={diff}
          session={session}
          comments={sessionComments}
          selectedPath={selectedPath}
          commentFilter={commentFilter}
          draftTarget={draftTarget}
          statusMessage={statusMessage}
          emptyState={emptyState}
          onBeginFileComment={(file) => {
            if (selectedSessionId) {
              setDraftTarget({ type: "file", sessionId: selectedSessionId, filePath: file.path });
            }
          }}
          onBeginLineComment={(file, line) => {
            const target = lineCommentTarget(selectedSessionId, file, line);
            if (target) {
              setDraftTarget(target);
            }
          }}
          onCancelComment={() => setDraftTarget(undefined)}
          onSaveComment={(body) => {
            void saveComment(body);
          }}
          onResolveComment={(commentId) => {
            void resolveComment(commentId);
          }}
        />
      </section>
    </div>
  );
}

function getDiffEmptyState(
  hasSelectedSlice: boolean,
  sessions: ReviewSession[],
  selectedSessionId: string | undefined,
  diffLoading: boolean,
  error: string | undefined
): { title: string; message: string } | undefined {
  if (!hasSelectedSlice) {
    return { title: "No slice selected", message: "Select a slice in the dependency canvas to inspect its review sessions." };
  }

  if (error) {
    return { title: "Review unavailable", message: error };
  }

  if (sessions.length === 0) {
    return {
      title: "No review session",
      message: "This slice has no review sessions yet. Commit the slice changes, then run pathfinder review start --base <base-ref>."
    };
  }

  if (!selectedSessionId) {
    return { title: "No session selected", message: "Select a review session from the sidebar." };
  }

  if (diffLoading) {
    return { title: "Loading diff", message: "Reading the selected slice review diff." };
  }

  return undefined;
}
