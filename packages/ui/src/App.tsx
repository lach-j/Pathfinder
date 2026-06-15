import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";

import { api } from "./api";
import type {
  ActiveSliceResponse,
  WorkstreamOverviewResponse,
  WorkspaceResponse
} from "./types";
import { WorkspaceShell } from "./workspace/WorkspaceShell";

export function App(): ReactElement {
  const [workspace, setWorkspace] = useState<WorkspaceResponse>();
  const [overview, setOverview] = useState<WorkstreamOverviewResponse>();
  const [selectedWorkstreamId, setSelectedWorkstreamId] = useState<string>();
  const [selectedSliceId, setSelectedSliceId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();

  const loadOverview = useCallback(async (workstreamId: string): Promise<WorkstreamOverviewResponse> => {
    return api<WorkstreamOverviewResponse>(
      `/api/workstreams/${encodeURIComponent(workstreamId)}/overview`
    );
  }, []);

  const loadWorkspace = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(undefined);
    try {
      const nextWorkspace = await api<WorkspaceResponse>("/api/workspace");
      const nextWorkstreamId =
        nextWorkspace.activeWorkstream?.id ||
        nextWorkspace.workstreams[0]?.id;

      setWorkspace(nextWorkspace);
      setSelectedWorkstreamId(nextWorkstreamId);

      if (!nextWorkstreamId) {
        setOverview(undefined);
        setSelectedSliceId(undefined);
        return;
      }

      const nextOverview = await loadOverview(nextWorkstreamId);
      const nextSliceId =
        nextWorkspace.activeWorkstream?.id === nextWorkstreamId
          ? nextWorkspace.activeSlice?.id || nextOverview.slices[0]?.id
          : nextOverview.slices[0]?.id;

      setOverview(nextOverview);
      setSelectedSliceId(nextSliceId);
    } catch (loadError) {
      setWorkspace(undefined);
      setOverview(undefined);
      setSelectedWorkstreamId(undefined);
      setSelectedSliceId(undefined);
      setError(loadError instanceof Error ? loadError.message : "Could not load Pathfinder workspace.");
    } finally {
      setLoading(false);
    }
  }, [loadOverview]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  async function selectWorkstream(workstreamId: string): Promise<void> {
    setSelectedWorkstreamId(workstreamId);
    setSelectedSliceId(undefined);
    setStatusMessage(undefined);

    try {
      const nextOverview = await loadOverview(workstreamId);
      setOverview(nextOverview);
      setSelectedSliceId(nextOverview.slices[0]?.id);
    } catch (selectError) {
      setOverview(undefined);
      setError(selectError instanceof Error ? selectError.message : "Could not load selected workstream.");
    }
  }

  async function makeSelectedSliceActive(): Promise<void> {
    if (!selectedWorkstreamId || !selectedSliceId) {
      return;
    }

    try {
      const active = await api<ActiveSliceResponse>(
        `/api/workstreams/${encodeURIComponent(selectedWorkstreamId)}/slices/${encodeURIComponent(selectedSliceId)}/active`,
        { method: "POST" }
      );
      setWorkspace((existing) => existing
        ? {
            ...existing,
            activeWorkstream: active.workstream,
            activeSlice: active.slice,
            project: {
              ...existing.project,
              activeWorkstreamId: active.workstream.id
            },
            workstreams: existing.workstreams.map((workstream) =>
              workstream.id === active.workstream.id ? active.workstream : workstream
            )
          }
        : existing);
      setOverview((existing) => existing && existing.workstream.id === active.workstream.id
        ? { ...existing, workstream: active.workstream }
        : existing);
      setStatusMessage("Active slice updated.");
    } catch (activeError) {
      setStatusMessage(activeError instanceof Error ? activeError.message : "Could not update active slice.");
    }
  }

  return (
    <WorkspaceShell
      workspace={workspace}
      overview={overview}
      selectedWorkstreamId={selectedWorkstreamId}
      selectedSliceId={selectedSliceId}
      loading={loading}
      error={error}
      statusMessage={statusMessage}
      onSelectWorkstream={(workstreamId) => {
        void selectWorkstream(workstreamId);
      }}
      onSelectSlice={(sliceId) => {
        setSelectedSliceId(sliceId);
        setStatusMessage(undefined);
      }}
      onMakeActive={() => {
        void makeSelectedSliceActive();
      }}
    />
  );
}
