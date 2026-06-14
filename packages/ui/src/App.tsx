import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";

import { api } from "./api";
import { DiffPane } from "./review/DiffPane";
import { FileList } from "./review/FileList";
import { ReviewHeader } from "./review/ReviewHeader";
import { firstFilePath, lineCommentTarget } from "./review/review-model";
import type {
  CommentFilter,
  CurrentContext,
  DiffFile,
  DiffLine,
  DraftTarget,
  ReviewComment,
  ReviewSession,
  ReviewCommentSide,
  StructuredDiff
} from "./types";

interface SessionsPayload {
  sessions: ReviewSession[];
}

interface DiffPayload {
  session: ReviewSession;
  diff: StructuredDiff;
}

interface CommentsPayload {
  comments: ReviewComment[];
}

interface RefreshPayload {
  session: ReviewSession;
  comments: ReviewComment[];
  diff: StructuredDiff;
}

export function App(): ReactElement {
  const [current, setCurrent] = useState<CurrentContext>();
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [session, setSession] = useState<ReviewSession>();
  const [diff, setDiff] = useState<StructuredDiff>();
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>();
  const [commentFilter, setCommentFilter] = useState<CommentFilter>("all");
  const [draftTarget, setDraftTarget] = useState<DraftTarget>();
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const workstreamId = current?.workstream?.id;

  const fetchComments = useCallback(async (nextWorkstreamId: string, sessionId: string): Promise<ReviewComment[]> => {
    const payload = await api<CommentsPayload>(
      `/api/workstreams/${encodeURIComponent(nextWorkstreamId)}/comments?session=${encodeURIComponent(sessionId)}`
    );
    return payload.comments || [];
  }, []);

  const selectSession = useCallback(async (sessionId: string, nextWorkstreamId = workstreamId): Promise<void> => {
    if (!nextWorkstreamId) {
      return;
    }

    const [diffPayload, commentsPayload] = await Promise.all([
      api<DiffPayload>(
        `/api/workstreams/${encodeURIComponent(nextWorkstreamId)}/review-sessions/${encodeURIComponent(sessionId)}/diff`
      ),
      fetchComments(nextWorkstreamId, sessionId)
    ]);

    setSession(diffPayload.session);
    setDiff(diffPayload.diff);
    setComments(commentsPayload);
    setSelectedPath(firstFilePath(diffPayload.diff));
    setDraftTarget(undefined);
    setStatusMessage("");
  }, [fetchComments, workstreamId]);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const currentPayload = await api<CurrentContext>("/api/current");
        if (cancelled) {
          return;
        }

        setCurrent(currentPayload);
        if (!currentPayload.workstream || !currentPayload.activeSlice) {
          setLoading(false);
          return;
        }

        const sessionsPayload = await api<SessionsPayload>(
          `/api/workstreams/${encodeURIComponent(currentPayload.workstream.id)}/review-sessions`
        );
        if (cancelled) {
          return;
        }

        const nextSessions = sessionsPayload.sessions || [];
        setSessions(nextSessions);
        if (nextSessions.length > 0) {
          await selectSession(nextSessions[nextSessions.length - 1].id, currentPayload.workstream.id);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unexpected review viewer error.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectSession]);

  const files = diff?.files || [];
  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedPath) || files[0],
    [files, selectedPath]
  );

  async function refreshComments(): Promise<void> {
    if (!workstreamId || !session) {
      return;
    }

    setComments(await fetchComments(workstreamId, session.id));
  }

  async function saveComment(body: string): Promise<void> {
    if (!workstreamId || !session || !draftTarget) {
      return;
    }

    const payload = draftTarget.type === "line"
      ? {
          body,
          sessionId: draftTarget.sessionId,
          filePath: draftTarget.filePath,
          lineNumber: draftTarget.lineNumber,
          side: draftTarget.side
        }
      : {
          body,
          sessionId: draftTarget.sessionId,
          filePath: draftTarget.filePath
        };

    try {
      await api(`/api/workstreams/${encodeURIComponent(workstreamId)}/comments`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setDraftTarget(undefined);
      setStatusMessage("Comment saved.");
      await refreshComments();
    } catch (saveError) {
      setStatusMessage(saveError instanceof Error ? saveError.message : "Could not save comment.");
    }
  }

  async function resolveComment(commentId: string): Promise<void> {
    if (!workstreamId || !session) {
      return;
    }

    try {
      await api(`/api/workstreams/${encodeURIComponent(workstreamId)}/comments/${encodeURIComponent(commentId)}/resolve`, {
        method: "POST"
      });
      setStatusMessage("Comment resolved.");
      await refreshComments();
    } catch (resolveError) {
      setStatusMessage(resolveError instanceof Error ? resolveError.message : "Could not resolve comment.");
    }
  }

  async function refreshReview(): Promise<void> {
    if (!workstreamId || !session) {
      return;
    }

    try {
      const payload = await api<RefreshPayload>(
        `/api/workstreams/${encodeURIComponent(workstreamId)}/review-sessions/${encodeURIComponent(session.id)}/refresh`,
        { method: "POST" }
      );
      setSession(payload.session);
      setSessions((existing) => existing.map((candidate) =>
        candidate.id === payload.session.id ? payload.session : candidate
      ));
      setDiff(payload.diff);
      setComments(payload.comments || []);
      setSelectedPath(firstFilePath(payload.diff) || selectedPath);
      setDraftTarget(undefined);
      setStatusMessage("Review refreshed.");
    } catch (refreshError) {
      setStatusMessage(refreshError instanceof Error ? refreshError.message : "Could not refresh review.");
    }
  }

  function beginFileComment(file: DiffFile): void {
    if (!session) {
      return;
    }

    setDraftTarget({
      type: "file",
      sessionId: session.id,
      filePath: file.path
    });
    setStatusMessage("");
  }

  function beginLineComment(file: DiffFile, line: DiffLine): void {
    if (!session) {
      return;
    }

    const target = lineCommentTarget(line);
    if (!target) {
      return;
    }

    setDraftTarget({
      type: "line",
      sessionId: session.id,
      filePath: file.path,
      side: target.side as ReviewCommentSide,
      lineNumber: target.lineNumber
    });
    setStatusMessage("");
  }

  function changeCommentFilter(filter: CommentFilter): void {
    setCommentFilter(filter);
    setDraftTarget(undefined);
  }

  const emptyState = getEmptyState({ loading, current, sessions, error });

  return (
    <main className="app">
      <ReviewHeader
        current={current}
        sessions={sessions}
        selectedSessionId={session?.id}
        commentFilter={commentFilter}
        onSelectSession={(sessionId) => {
          void selectSession(sessionId).catch((selectError) => {
            setError(selectError instanceof Error ? selectError.message : "Could not load review session.");
          });
        }}
        onChangeCommentFilter={changeCommentFilter}
        onRefresh={() => {
          void refreshReview();
        }}
      />
      <section className="layout">
        <aside className="sidebar">
          <FileList
            files={files}
            selectedPath={selectedFile?.path}
            onSelectFile={(path) => {
              setSelectedPath(path);
              setDraftTarget(undefined);
            }}
          />
        </aside>
        <DiffPane
          diff={diff}
          session={session}
          comments={comments}
          selectedPath={selectedFile?.path}
          commentFilter={commentFilter}
          draftTarget={draftTarget}
          statusMessage={statusMessage}
          emptyState={emptyState}
          onBeginFileComment={beginFileComment}
          onBeginLineComment={beginLineComment}
          onCancelComment={() => setDraftTarget(undefined)}
          onSaveComment={(body) => {
            void saveComment(body);
          }}
          onResolveComment={(commentId) => {
            void resolveComment(commentId);
          }}
        />
      </section>
    </main>
  );
}

function getEmptyState({
  loading,
  current,
  sessions,
  error
}: {
  loading: boolean;
  current: CurrentContext | undefined;
  sessions: ReviewSession[];
  error: string | undefined;
}): { title: string; message: string } | undefined {
  if (loading) {
    return { title: "Loading review", message: "Reading Pathfinder state from this repository." };
  }

  if (error) {
    return { title: "Could not load review data", message: error };
  }

  if (!current?.workstream) {
    return { title: "No active workstream", message: "Create or select a workstream before opening the review viewer." };
  }

  if (!current.activeSlice) {
    return { title: "No active slice", message: "Set an active slice before starting a review session." };
  }

  if (sessions.length === 0) {
    return { title: "No review sessions", message: "Start a review session with pathfinder review start --base <base-ref>." };
  }

  return undefined;
}
