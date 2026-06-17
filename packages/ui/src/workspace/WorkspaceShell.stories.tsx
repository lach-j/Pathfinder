import type { Meta, StoryObj } from "@storybook/react-vite";

import { DiffPane } from "../review/DiffPane";
import { FileList } from "../review/FileList";
import { reviewCommentSummary } from "../review/review-model";
import type { BranchReviewSession } from "../types";
import { WorkspaceShell } from "./WorkspaceShell";
import {
  branchReviewDiffFixture,
  branchReviewOverviewFixture,
  emptyWorkspaceFixture,
  overviewFixture,
  workspaceFixture
} from "./workspace.fixtures";

const noop = (): void => {};

const meta = {
  title: "Workspace/WorkspaceShell",
  component: WorkspaceShell,
  tags: ["autodocs"],
  args: {
    selectedWorkstreamId: workspaceFixture.activeWorkstream?.id,
    selectedSliceId: workspaceFixture.activeSlice?.id,
    onSelectWorkstream: noop,
    onSelectSlice: noop,
    onMakeActive: noop
  },
  parameters: {
    docs: {
      description: {
        component: "Browser-safe Storybook coverage for the current Pathfinder workspace shell states."
      }
    }
  }
} satisfies Meta<typeof WorkspaceShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LoadedWorkspace: Story = {
  args: {
    workspace: workspaceFixture,
    overview: overviewFixture,
    loading: false,
    statusMessage: "Active slice updated."
  }
};

export const LoadingWorkspace: Story = {
  args: {
    loading: true
  }
};

export const EmptyWorkspace: Story = {
  args: {
    workspace: emptyWorkspaceFixture,
    loading: false
  }
};

export const WorkspaceError: Story = {
  args: {
    loading: false,
    error: "Pathfinder state was not found for this repository."
  }
};

export const BranchReviewMode: Story = {
  args: {
    workspace: workspaceFixture,
    overview: overviewFixture,
    loading: false,
    initialMode: "branch-review",
    renderBranchReview: () => <BranchReviewPreview />
  }
};

function BranchReviewPreview() {
  const session = branchReviewOverviewFixture.sessions[0] as BranchReviewSession;
  const selectedPath = branchReviewDiffFixture.files[0]?.path;
  const summary = reviewCommentSummary(branchReviewOverviewFixture.comments);

  return (
    <div className="branch-review-workspace">
      <aside className="branch-review-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">Branch review</div>
          <div className="sidebar-meta">1 session</div>
        </div>
        <div className="session-list">
          <button className="session-button" type="button" aria-current="true">
            <span className="session-title">{session.id}</span>
            <span className="session-meta">{session.baseRef} to {session.headRef}</span>
            <span className="session-meta">1 open comment</span>
          </button>
        </div>
        <FileList
          comments={branchReviewOverviewFixture.comments}
          files={branchReviewDiffFixture.files}
          selectedPath={selectedPath}
          onSelectFile={noop}
        />
      </aside>
      <section className="branch-review-main">
        <div className="branch-review-toolbar">
          <div className="identity">
            <div className="eyebrow">Pathfinder Branch Review</div>
            <h1>{session.headRef}</h1>
            <div className="slice">{session.baseRef} to {session.headCommit}</div>
            <div className="review-status-strip" aria-label="Review comment status">
              <span>{summary.open} open</span>
              <span>{summary.resolved} resolved</span>
              {summary.stale > 0 && <span className="is-stale">{summary.stale} stale</span>}
            </div>
          </div>
          <div className="review-controls">
            <div className="control">
              <label htmlFor="storybook-branch-comment-filter">Comments</label>
              <select id="storybook-branch-comment-filter" defaultValue="open">
                <option value="all">All comments</option>
                <option value="open">Open comments</option>
                <option value="resolved">Resolved comments</option>
              </select>
            </div>
            <button className="button" type="button">Refresh</button>
          </div>
        </div>
        <DiffPane
          diff={branchReviewDiffFixture}
          session={session}
          comments={branchReviewOverviewFixture.comments}
          selectedPath={selectedPath}
          commentFilter="open"
          draftTarget={undefined}
          statusMessage="Branch review refreshed."
          onBeginFileComment={noop}
          onBeginLineComment={noop}
          onCancelComment={noop}
          onSaveComment={noop}
          onResolveComment={noop}
        />
      </section>
    </div>
  );
}
