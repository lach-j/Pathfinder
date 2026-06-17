import type {
  BranchReviewOverviewResponse,
  StructuredDiff,
  WorkstreamOverviewResponse,
  WorkspaceResponse
} from "../types";

const now = "2026-06-17T09:56:19.125Z";

export const workspaceFixture: WorkspaceResponse = {
  project: {
    schemaVersion: 1,
    name: "Pathfinder",
    createdAt: "2026-06-14T01:25:00.000Z",
    activeWorkstreamId: "ui-overhaul-and-design-system"
  },
  activeWorkstream: {
    id: "ui-overhaul-and-design-system",
    title: "UI Overhaul And Design System",
    activeSliceId: "slice-61-storybook-foundation",
    createdAt: "2026-06-17T09:39:32.000Z",
    updatedAt: now
  },
  activeSlice: {
    id: "slice-61-storybook-foundation",
    title: "Slice 61: Storybook Foundation",
    description: "Add Storybook to @pathfinder/ui with scripts, preview decorators, browser-safe Pathfinder fixtures, base CSS loading, and initial stories for current shell states.",
    status: "in_progress",
    dependsOnSliceIds: ["slice-60-ui-audit-and-experience-principles"],
    branchName: "pathfinder/ui-overhaul-and-design-system/slice-61-storybook-foundation",
    baseRef: "main",
    startedAt: now,
    createdAt: "2026-06-17T09:39:32.413Z",
    updatedAt: now
  },
  workstreams: [
    {
      id: "ui-overhaul-and-design-system",
      title: "UI Overhaul And Design System",
      activeSliceId: "slice-61-storybook-foundation",
      createdAt: "2026-06-17T09:39:32.000Z",
      updatedAt: now
    },
    {
      id: "branch-review-polish",
      title: "Branch Review Polish",
      activeSliceId: "slice-18-review-refresh",
      createdAt: "2026-06-15T08:20:00.000Z",
      updatedAt: "2026-06-16T17:20:00.000Z"
    },
    {
      id: "agent-setup-hardening",
      title: "Agent Setup Hardening",
      createdAt: "2026-06-11T04:10:00.000Z",
      updatedAt: "2026-06-13T20:45:00.000Z"
    }
  ]
};

export const overviewFixture: WorkstreamOverviewResponse = {
  workstream: workspaceFixture.activeWorkstream!,
  requirements: {
    path: ".pathfinder/workstreams/ui-overhaul-and-design-system/requirements.md",
    markdown: [
      "# UI Overhaul And Design System Requirements",
      "",
      "Create a polished local developer workspace while preserving Pathfinder's filesystem-first boundaries.",
      "",
      "- Add Storybook for isolated UI review.",
      "- Keep stories browser-safe with mocked data.",
      "- Preserve review readability and local-only assumptions."
    ].join("\n")
  },
  plan: {
    path: ".pathfinder/workstreams/ui-overhaul-and-design-system/plan.md",
    markdown: [
      "# UI Overhaul And Design System Plan",
      "",
      "1. Audit the current UI.",
      "2. Add Storybook foundations.",
      "3. Centralize tokens and primitives.",
      "4. Refresh workspace and review surfaces."
    ].join("\n")
  },
  slices: [
    {
      id: "slice-60-ui-audit-and-experience-principles",
      title: "Slice 60: UI Audit And Experience Principles",
      description: "Capture current workspace pain points, responsive concerns, accessibility concerns, and before-state notes.",
      status: "complete",
      branchName: "pathfinder/ui-overhaul-and-design-system/slice-60-ui-audit-and-experience-principles",
      baseRef: "main",
      createdAt: "2026-06-17T09:39:32.272Z",
      updatedAt: "2026-06-17T09:54:58.576Z"
    },
    workspaceFixture.activeSlice!,
    {
      id: "slice-62-design-tokens-and-app-foundations",
      title: "Slice 62: Design Tokens And App Foundations",
      description: "Centralize UI tokens and global foundations for color, typography, spacing, borders, elevation, focus, density, and motion.",
      status: "ready",
      dependsOnSliceIds: ["slice-61-storybook-foundation"],
      createdAt: "2026-06-17T09:39:32.557Z",
      updatedAt: "2026-06-17T09:39:33.527Z"
    },
    {
      id: "slice-66-review-experience-refresh",
      title: "Slice 66: Review Experience Refresh",
      description: "Refresh slice and branch review surfaces with a code-review-first layout.",
      status: "proposed",
      dependsOnSliceIds: ["slice-64-workspace-shell-ux-refresh", "slice-63-base-design-system-components"],
      createdAt: "2026-06-17T09:39:33.112Z",
      updatedAt: "2026-06-17T09:39:34.189Z"
    }
  ],
  comments: [
    {
      id: "comment-1",
      sliceId: "slice-61-storybook-foundation",
      body: "Cover both loaded and empty shell states so future visual changes have stable review targets.",
      origin: "human",
      resolved: false,
      anchorStatus: "current",
      target: { type: "slice", sliceId: "slice-61-storybook-foundation" }
    },
    {
      id: "comment-2",
      body: "This branch review comment is resolved and should stay visible in all-comment views.",
      origin: "human",
      resolved: true,
      anchorStatus: "current",
      target: { type: "line", sessionId: "review-61", filePath: "packages/ui/src/App.tsx", lineNumber: 17, side: "new" }
    }
  ],
  reviewSessions: [
    {
      id: "review-61",
      workstreamId: "ui-overhaul-and-design-system",
      sliceId: "slice-61-storybook-foundation",
      baseRef: "main",
      headRef: "pathfinder/ui-overhaul-and-design-system/slice-61-storybook-foundation",
      mergeBase: "5a2b63c",
      headCommit: "8f4d219",
      changedFiles: [],
      createdAt: "2026-06-17T10:05:00.000Z"
    }
  ],
  reviews: [
    {
      id: "review-summary-61",
      sliceId: "slice-61-storybook-foundation",
      status: "open",
      summary: "Storybook foundation is ready for local visual review."
    }
  ],
  evidence: [
    {
      id: "evidence-storybook-build",
      sliceId: "slice-61-storybook-foundation",
      kind: "build",
      description: "Static Storybook build completed locally.",
      path: "packages/ui/storybook-static",
      createdAt: now
    }
  ],
  prDraft: {
    path: ".pathfinder/workstreams/ui-overhaul-and-design-system/pr-draft.md",
    markdown: [
      "## Summary",
      "",
      "- Add Storybook to @pathfinder/ui.",
      "- Add shell fixtures and stories for visual review.",
      "",
      "## Testing",
      "",
      "- npm run build-storybook -w @pathfinder/ui"
    ].join("\n")
  }
};

export const emptyWorkspaceFixture: WorkspaceResponse = {
  project: {
    schemaVersion: 1,
    name: "Empty Pathfinder Workspace",
    createdAt: now
  },
  workstreams: []
};

export const branchReviewOverviewFixture: BranchReviewOverviewResponse = {
  sessions: [
    {
      id: "branch-review-2026-06-17",
      baseRef: "main",
      headRef: "pathfinder/ui-overhaul-and-design-system/slice-61-storybook-foundation",
      mergeBase: "5a2b63c",
      headCommit: "8f4d219",
      changedFiles: [],
      createdAt: "2026-06-17T10:12:00.000Z"
    }
  ],
  comments: [
    {
      id: "branch-comment-1",
      body: "The branch review shell should make session selection and open comments easy to scan.",
      origin: "human",
      resolved: false,
      anchorStatus: "current",
      target: { type: "file", sessionId: "branch-review-2026-06-17", filePath: "packages/ui/src/workspace/WorkspaceShell.tsx" }
    }
  ],
  prDraft: {
    path: ".pathfinder/branch-review/pr-draft.md",
    markdown: "## Summary\n\n- Preview branch review shell states in Storybook."
  }
};

export const branchReviewDiffFixture: StructuredDiff = {
  files: [
    {
      path: "packages/ui/src/workspace/WorkspaceShell.tsx",
      status: "modified",
      hunks: [
        {
          header: "@@ -12,6 +12,8 @@",
          lines: [
            { kind: "context", text: "  loading: boolean;", oldLineNumber: 12, newLineNumber: 12 },
            { kind: "addition", text: "  initialMode?: \"workstreams\" | \"branch-review\";", newLineNumber: 13 },
            { kind: "addition", text: "  renderBranchReview?: () => ReactElement;", newLineNumber: 14 },
            { kind: "context", text: "  onSelectWorkstream: (workstreamId: string) => void;", oldLineNumber: 13, newLineNumber: 15 }
          ]
        }
      ]
    }
  ]
};
