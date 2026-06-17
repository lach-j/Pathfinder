import "@xyflow/react/dist/style.css";

import type { ReactElement } from "react";
import { useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";

import type { Slice, WorkstreamOverviewResponse } from "../types";
import { countsForSlice } from "./workspace-model";

interface SliceDependencyCanvasProps {
  overview: WorkstreamOverviewResponse;
  activeSliceId?: string;
  selectedSliceId?: string;
  onSelectSlice: (sliceId: string) => void;
}

interface SliceNodeData extends Record<string, unknown> {
  slice: Slice;
  isActive: boolean;
  isSelected: boolean;
  openCommentCount: number;
  reviewSessionCount: number;
  evidenceCount: number;
}

interface SliceGraph {
  nodes: Node<SliceNodeData>[];
  edges: Edge[];
  warnings: string[];
}

const nodeWidth = 300;
const nodeHeight = 176;
const columnGap = 120;
const rowGap = 44;

const nodeTypes = {
  sliceNode: SliceNode,
};

export function SliceDependencyCanvas({
  overview,
  activeSliceId,
  selectedSliceId,
  onSelectSlice,
}: SliceDependencyCanvasProps): ReactElement {
  const graph = useMemo(
    () => buildSliceGraph(overview, activeSliceId, selectedSliceId),
    [activeSliceId, overview, selectedSliceId],
  );

  if (overview.slices.length === 0) {
    return (
      <div className="canvas-empty">
        <h3>No slices</h3>
        <p>This workstream does not have implementation slices yet.</p>
      </div>
    );
  }

  return (
    <div className="dependency-canvas">
      {graph.warnings.length > 0 ? (
        <div className="dependency-warning" role="alert">
          <strong>Dependency warning</strong>
          <ul>
            {graph.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.35}
        maxZoom={1.4}
        onNodeClick={(_, node) => onSelectSlice(node.id)}
      >
        <Background gap={18} color="var(--pf-color-canvas-grid)" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            const status = (node.data as SliceNodeData | undefined)?.slice
              .status;
            return statusColor(status);
          }}
        />
      </ReactFlow>
    </div>
  );
}

function buildSliceGraph(
  overview: WorkstreamOverviewResponse,
  activeSliceId?: string,
  selectedSliceId?: string,
): SliceGraph {
  const warnings = dependencyWarnings(overview.slices);
  const columns = dependencyColumns(overview.slices);
  const rowsByColumn = new Map<number, number>();

  const nodes = overview.slices.map((slice): Node<SliceNodeData> => {
    const column = columns.get(slice.id) || 0;
    const row = rowsByColumn.get(column) || 0;
    rowsByColumn.set(column, row + 1);
    const counts = countsForSlice(
      slice,
      overview.comments,
      overview.reviewSessions,
      overview.evidence,
    );

    return {
      id: slice.id,
      type: "sliceNode",
      position: {
        x: column * (nodeWidth + columnGap),
        y: row * (nodeHeight + rowGap),
      },
      draggable: false,
      data: {
        slice,
        isActive: slice.id === activeSliceId,
        isSelected: slice.id === selectedSliceId,
        openCommentCount: counts.openCommentCount,
        reviewSessionCount: counts.reviewSessionCount,
        evidenceCount: counts.evidenceCount,
      },
    };
  });

  const sliceIds = new Set(overview.slices.map((slice) => slice.id));
  const edges = overview.slices.flatMap((slice) =>
    (slice.dependsOnSliceIds || [])
      .filter((dependencyId) => sliceIds.has(dependencyId))
      .map(
        (dependencyId): Edge => ({
          id: `${dependencyId}->${slice.id}`,
          source: dependencyId,
          target: slice.id,
          sourceHandle: "out",
          targetHandle: "in",
          type: "bezier",
          animated: slice.id === activeSliceId,
          style: { stroke: "var(--pf-color-border-strong)", strokeWidth: 2 },
        }),
      ),
  );

  return { nodes, edges, warnings };
}

function dependencyWarnings(slices: Slice[]): string[] {
  const sliceIds = new Set(slices.map((slice) => slice.id));
  const warnings: string[] = [];

  for (const slice of slices) {
    for (const dependencyId of slice.dependsOnSliceIds || []) {
      if (!sliceIds.has(dependencyId)) {
        warnings.push(`${slice.id} depends on missing slice ${dependencyId}.`);
      }
    }
  }

  const cycle = findCycle(slices);
  if (cycle.length > 0) {
    warnings.push(`Dependency cycle detected: ${cycle.join(" -> ")}.`);
  }

  return warnings;
}

function dependencyColumns(slices: Slice[]): Map<string, number> {
  const byId = new Map(slices.map((slice) => [slice.id, slice]));
  const columns = new Map<string, number>();
  const visiting = new Set<string>();

  function depthFor(slice: Slice): number {
    const existing = columns.get(slice.id);
    if (existing !== undefined) {
      return existing;
    }

    if (visiting.has(slice.id)) {
      return 0;
    }

    visiting.add(slice.id);
    const dependencyDepths = (slice.dependsOnSliceIds || [])
      .map((dependencyId) => byId.get(dependencyId))
      .filter((dependency): dependency is Slice => Boolean(dependency))
      .map((dependency) => depthFor(dependency));
    visiting.delete(slice.id);

    const depth =
      dependencyDepths.length === 0 ? 0 : Math.max(...dependencyDepths) + 1;
    columns.set(slice.id, depth);
    return depth;
  }

  for (const slice of slices) {
    depthFor(slice);
  }

  return columns;
}

function findCycle(slices: Slice[]): string[] {
  const byId = new Map(slices.map((slice) => [slice.id, slice]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  function visit(slice: Slice): string[] {
    if (visiting.has(slice.id)) {
      return path.slice(path.indexOf(slice.id)).concat(slice.id);
    }

    if (visited.has(slice.id)) {
      return [];
    }

    visiting.add(slice.id);
    path.push(slice.id);

    for (const dependencyId of slice.dependsOnSliceIds || []) {
      const dependency = byId.get(dependencyId);
      if (!dependency) {
        continue;
      }

      const cycle = visit(dependency);
      if (cycle.length > 0) {
        return cycle;
      }
    }

    path.pop();
    visiting.delete(slice.id);
    visited.add(slice.id);
    return [];
  }

  for (const slice of slices) {
    const cycle = visit(slice);
    if (cycle.length > 0) {
      return cycle;
    }
  }

  return [];
}

function SliceNode({ data }: NodeProps<Node<SliceNodeData>>): ReactElement {
  const { slice } = data;

  return (
    <div
      className={[
        "dependency-node",
        `dependency-node-${slice.status}`,
        data.isSelected ? "is-selected" : "",
        data.isActive ? "is-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        className="dependency-handle"
        isConnectable={false}
      />
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        className="dependency-handle"
        isConnectable={false}
      />
      <div className="dependency-node-top">
        <span className="dependency-node-title">{slice.title}</span>
        <span className="slice-status">{slice.status.replace("_", " ")}</span>
      </div>
      <div className="dependency-node-id">
        {slice.id}
        {data.isActive ? " · active" : ""}
      </div>
      <div className="dependency-node-meta">
        {slice.branchName ? <span>Branch {slice.branchName}</span> : null}
        {slice.baseRef ? <span>Base {slice.baseRef}</span> : null}
        {!slice.branchName && !slice.baseRef ? <span>Not started</span> : null}
      </div>
      <div className="dependency-node-counts" aria-label="Slice related counts">
        <span>{data.openCommentCount} open comments</span>
        <span>{data.reviewSessionCount} reviews</span>
        <span>{data.evidenceCount} evidence</span>
      </div>
    </div>
  );
}

function statusColor(status: Slice["status"] | undefined): string {
  if (status === "complete") {
    return "var(--pf-status-complete)";
  }

  if (status === "review") {
    return "var(--pf-status-review)";
  }

  if (status === "ready" || status === "in_progress") {
    return "var(--pf-status-ready)";
  }

  return "var(--pf-status-proposed)";
}
