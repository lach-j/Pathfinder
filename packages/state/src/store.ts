import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DeterministicReviewResult,
  Evidence,
  ImportedStagePlan,
  PathfinderError,
  Project,
  RepositorySummary,
  Review,
  ReviewComment,
  ReviewSession,
  Slice,
  SliceStatus,
  Workstream,
  assertNonEmptyText,
  createTimestamp,
  findNextActionableSlice,
  generateDeterministicReview,
  generatePrMarkdown,
  isEvidenceKind,
  isSliceStatus,
  nextAvailableId,
  parseStagePlanMarkdown,
  toUrlSafeId
} from "@pathfinder/core";

import { exists } from "./file-system.js";
import { findGitRoot } from "./git-root.js";
import { readJson, writeJson } from "./json-file.js";
import { validateDependencies } from "./slice-dependencies.js";

export interface ActiveSlice {
  workstream: Workstream;
  slice: Slice;
}

export interface CurrentContext {
  project: Project;
  workstream?: Workstream;
  activeSlice?: Slice;
  requirementsPath?: string;
  requirementsMarkdown?: string;
  planPath?: string;
  planMarkdown?: string;
  unresolvedComments: ReviewComment[];
  evidence: Evidence[];
}

export interface GeneratedPrMarkdown {
  markdown: string;
  path: string;
}

export interface DeterministicReviewRecord {
  review: Review;
  result: DeterministicReviewResult;
}

export interface SliceBranchMetadata {
  branchName: string;
  baseRef: string;
  startedAt: string;
}

export interface ImportedStagePlanState {
  plan: ImportedStagePlan;
  workstream: Workstream;
  slices: Slice[];
}

interface SlicesFile {
  slices: Slice[];
}

interface CommentsFile {
  comments: ReviewComment[];
}

interface ReviewsFile {
  reviews: Review[];
}

interface ReviewSessionsFile {
  sessions: ReviewSession[];
}

interface EvidenceFile {
  evidence: Evidence[];
}

export class PathfinderStore {
  private readonly cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = path.resolve(cwd);
  }

  async initProject(): Promise<Project> {
    const gitRoot = await findGitRoot(this.cwd);
    if (!gitRoot) {
      throw new PathfinderError("pathfinder init must be run inside a Git repository.");
    }

    const stateRoot = path.join(gitRoot, ".pathfinder");
    const projectPath = path.join(stateRoot, "project.json");

    if (await exists(projectPath)) {
      throw new PathfinderError("Pathfinder state already exists in this repository.");
    }

    const now = createTimestamp();
    const project: Project = {
      schemaVersion: 1,
      name: path.basename(gitRoot),
      createdAt: now
    };

    await mkdir(path.join(stateRoot, "workstreams"), { recursive: true });
    await writeJson(projectPath, project);
    return project;
  }

  async getProject(): Promise<Project> {
    const stateRoot = await this.requireStateRoot();
    return readJson<Project>(path.join(stateRoot, "project.json"));
  }

  async createWorkstream(title: string): Promise<Workstream> {
    const stateRoot = await this.requireStateRoot();
    const cleanTitle = assertNonEmptyText(title, "Workstream title");
    const existingIds = await this.listWorkstreamIds();
    const id = nextAvailableId(toUrlSafeId(cleanTitle), existingIds);
    const workstreamRoot = path.join(stateRoot, "workstreams", id);

    if (await exists(workstreamRoot)) {
      throw new PathfinderError(`Workstream '${id}' already exists.`);
    }

    const now = createTimestamp();
    const workstream: Workstream = {
      id,
      title: cleanTitle,
      createdAt: now,
      updatedAt: now
    };

    await mkdir(workstreamRoot, { recursive: false });
    await writeJson(path.join(workstreamRoot, "workstream.json"), workstream);
    await writeFile(path.join(workstreamRoot, "requirements.md"), "", "utf8");
    await writeFile(path.join(workstreamRoot, "plan.md"), "", "utf8");
    await writeJson(path.join(workstreamRoot, "slices.json"), { slices: [] } satisfies SlicesFile);
    await writeJson(path.join(workstreamRoot, "comments.json"), { comments: [] } satisfies CommentsFile);
    await writeJson(path.join(workstreamRoot, "reviews.json"), { reviews: [] } satisfies ReviewsFile);
    await writeJson(
      path.join(workstreamRoot, "review-sessions.json"),
      { sessions: [] } satisfies ReviewSessionsFile
    );
    await writeJson(path.join(workstreamRoot, "evidence.json"), { evidence: [] } satisfies EvidenceFile);
    await writeFile(path.join(workstreamRoot, "pr.md"), "", "utf8");

    return workstream;
  }

  async listWorkstreams(): Promise<Workstream[]> {
    const ids = await this.listWorkstreamIds();
    const workstreams = await Promise.all(ids.map((id) => this.getWorkstream(id)));
    return workstreams.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async getWorkstream(id: string): Promise<Workstream> {
    const root = await this.requireWorkstreamRoot(id);
    return readJson<Workstream>(path.join(root, "workstream.json"));
  }

  async setRequirementsFromFile(workstreamId: string, sourceFile: string): Promise<void> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const sourcePath = path.resolve(this.cwd, sourceFile);

    if (!(await exists(sourcePath))) {
      throw new PathfinderError(`Requirements file not found: ${sourceFile}`);
    }

    const content = await readFile(sourcePath, "utf8");
    await writeFile(path.join(root, "requirements.md"), content, "utf8");
  }

  async getRequirements(workstreamId: string): Promise<string> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const requirementsPath = path.join(root, "requirements.md");

    if (!(await exists(requirementsPath))) {
      return "";
    }

    return readFile(requirementsPath, "utf8");
  }

  async setPlanFromFile(workstreamId: string, sourceFile: string): Promise<void> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const sourcePath = path.resolve(this.cwd, sourceFile);

    if (!(await exists(sourcePath))) {
      throw new PathfinderError(`Plan file not found: ${sourceFile}`);
    }

    const content = await readFile(sourcePath, "utf8");
    await writeFile(path.join(root, "plan.md"), content, "utf8");
  }

  async importStagePlanFromFile(sourceFile: string): Promise<ImportedStagePlanState> {
    const stateRoot = await this.requireStateRoot();
    const sourcePath = path.resolve(this.cwd, sourceFile);

    if (!(await exists(sourcePath))) {
      throw new PathfinderError(`Plan file not found: ${sourceFile}`);
    }

    const markdown = await readFile(sourcePath, "utf8");
    const plan = parseStagePlanMarkdown(markdown);
    const existingIds = await this.listWorkstreamIds();
    const workstreamId = nextAvailableId(toUrlSafeId(plan.workstreamTitle), existingIds);
    const workstreamRoot = path.join(stateRoot, "workstreams", workstreamId);

    if (await exists(workstreamRoot)) {
      throw new PathfinderError(`Workstream '${workstreamId}' already exists.`);
    }

    const now = createTimestamp();
    const workstream: Workstream = {
      id: workstreamId,
      title: plan.workstreamTitle,
      createdAt: now,
      updatedAt: now
    };
    const sliceIds: string[] = [];
    const slices: Slice[] = plan.stages.map((stage) => {
      const id = nextAvailableId(toUrlSafeId(stage.title), sliceIds);
      sliceIds.push(id);

      return {
        id,
        title: stage.title,
        description: stage.description,
        status: "proposed",
        createdAt: now,
        updatedAt: now
      };
    });

    await mkdir(workstreamRoot, { recursive: false });
    await writeJson(path.join(workstreamRoot, "workstream.json"), workstream);
    await writeFile(path.join(workstreamRoot, "requirements.md"), "", "utf8");
    await writeFile(path.join(workstreamRoot, "plan.md"), plan.markdown, "utf8");
    await writeJson(path.join(workstreamRoot, "slices.json"), { slices } satisfies SlicesFile);
    await writeJson(path.join(workstreamRoot, "comments.json"), { comments: [] } satisfies CommentsFile);
    await writeJson(path.join(workstreamRoot, "reviews.json"), { reviews: [] } satisfies ReviewsFile);
    await writeJson(
      path.join(workstreamRoot, "review-sessions.json"),
      { sessions: [] } satisfies ReviewSessionsFile
    );
    await writeJson(path.join(workstreamRoot, "evidence.json"), { evidence: [] } satisfies EvidenceFile);
    await writeFile(path.join(workstreamRoot, "pr.md"), "", "utf8");

    return { plan, workstream, slices };
  }

  async getPlan(workstreamId: string): Promise<string> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    return readFile(path.join(root, "plan.md"), "utf8");
  }

  async addSlice(
    workstreamId: string,
    title: string,
    description: string,
    dependsOnSliceIds: string[] = []
  ): Promise<Slice> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const cleanTitle = assertNonEmptyText(title, "Slice title");
    const cleanDescription = assertNonEmptyText(description, "Slice description");
    const slicesFile = await this.readSlices(root);
    const id = nextAvailableId(
      toUrlSafeId(cleanTitle),
      slicesFile.slices.map((slice) => slice.id)
    );
    const dependencies = validateDependencies(workstreamId, slicesFile.slices, id, dependsOnSliceIds);
    const now = createTimestamp();
    const slice: Slice = {
      id,
      title: cleanTitle,
      description: cleanDescription,
      status: "proposed",
      ...(dependencies.length > 0 ? { dependsOnSliceIds: dependencies } : {}),
      createdAt: now,
      updatedAt: now
    };

    slicesFile.slices.push(slice);
    await writeJson(path.join(root, "slices.json"), slicesFile);
    return slice;
  }

  async listSlices(workstreamId: string): Promise<Slice[]> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const slicesFile = await this.readSlices(root);
    return slicesFile.slices;
  }

  async addSliceDependency(
    workstreamId: string,
    sliceId: string,
    dependencySliceId: string
  ): Promise<Slice> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const slicesFile = await this.readSlices(root);
    const index = slicesFile.slices.findIndex((candidate) => candidate.id === sliceId);

    if (index === -1) {
      throw new PathfinderError(`Slice '${sliceId}' was not found in workstream '${workstreamId}'.`);
    }

    const dependencies = validateDependencies(workstreamId, slicesFile.slices, sliceId, [
      ...(slicesFile.slices[index].dependsOnSliceIds ?? []),
      dependencySliceId
    ]);
    const updated: Slice = {
      ...slicesFile.slices[index],
      dependsOnSliceIds: dependencies,
      updatedAt: createTimestamp()
    };

    slicesFile.slices[index] = updated;
    await writeJson(path.join(root, "slices.json"), slicesFile);
    return updated;
  }

  async getNextSlice(workstreamId: string): Promise<Slice | undefined> {
    return findNextActionableSlice(await this.listSlices(workstreamId));
  }

  async updateSliceStatus(workstreamId: string, sliceId: string, status: string): Promise<Slice> {
    if (!isSliceStatus(status)) {
      throw new PathfinderError(
        `Invalid slice status '${status}'. Expected one of: proposed, ready, in_progress, review, complete.`
      );
    }

    return this.updateSlice(workstreamId, sliceId, (slice) => ({
      ...slice,
      status: status satisfies SliceStatus,
      updatedAt: createTimestamp()
    }));
  }

  async setSliceBranchMetadata(
    workstreamId: string,
    sliceId: string,
    metadata: Omit<SliceBranchMetadata, "startedAt"> & { startedAt?: string }
  ): Promise<Slice> {
    const branchName = assertNonEmptyText(metadata.branchName, "Branch name");
    const baseRef = assertNonEmptyText(metadata.baseRef, "Base ref");
    const startedAt = metadata.startedAt ?? createTimestamp();

    return this.updateSlice(workstreamId, sliceId, (slice) => ({
      ...slice,
      branchName,
      baseRef,
      startedAt,
      updatedAt: createTimestamp()
    }));
  }

  async addComment(workstreamId: string, sliceId: string, body: string): Promise<ReviewComment> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const cleanBody = assertNonEmptyText(body, "Comment body");
    const slices = await this.listSlices(workstreamId);
    const slice = slices.find((candidate) => candidate.id === sliceId);

    if (!slice) {
      throw new PathfinderError(`Slice '${sliceId}' was not found in workstream '${workstreamId}'.`);
    }

    const commentsFile = await this.readComments(root);
    const id = nextAvailableId(
      toUrlSafeId(cleanBody),
      commentsFile.comments.map((comment) => comment.id)
    );
    const comment: ReviewComment = {
      id,
      sliceId,
      body: cleanBody,
      resolved: false,
      createdAt: createTimestamp()
    };

    commentsFile.comments.push(comment);
    await writeJson(path.join(root, "comments.json"), commentsFile);
    return comment;
  }

  async listComments(workstreamId: string): Promise<ReviewComment[]> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const commentsFile = await this.readComments(root);
    return commentsFile.comments;
  }

  async createReview(workstreamId: string, sliceId: string, summary: string): Promise<Review> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const cleanSummary = assertNonEmptyText(summary, "Review summary");
    const slices = await this.listSlices(workstreamId);
    const slice = slices.find((candidate) => candidate.id === sliceId);

    if (!slice) {
      throw new PathfinderError(`Slice '${sliceId}' was not found in workstream '${workstreamId}'.`);
    }

    const reviewsFile = await this.readReviews(root);
    const id = nextAvailableId(
      toUrlSafeId(cleanSummary),
      reviewsFile.reviews.map((review) => review.id)
    );
    const now = createTimestamp();
    const review: Review = {
      id,
      sliceId,
      status: "open",
      summary: cleanSummary,
      comments: [],
      evidence: [],
      createdAt: now,
      updatedAt: now
    };

    reviewsFile.reviews.push(review);
    await writeJson(path.join(root, "reviews.json"), reviewsFile);
    return review;
  }

  async runDeterministicReview(
    baseRef: string,
    repositorySummary: RepositorySummary
  ): Promise<DeterministicReviewRecord> {
    const active = await this.getActiveSlice();

    if (!active) {
      throw new PathfinderError("No active slice set. Use 'pathfinder slice active <workstream-id> <slice-id>' first.");
    }

    const root = await this.requireWorkstreamRoot(active.workstream.id);
    const comments = (await this.listComments(active.workstream.id)).filter((comment) => !comment.resolved);
    const evidence = (await this.listEvidence(active.workstream.id)).filter(
      (item) => item.sliceId === active.slice.id
    );
    const result = generateDeterministicReview({
      baseRef,
      workstream: active.workstream,
      activeSlice: active.slice,
      planMarkdown: await this.getPlan(active.workstream.id),
      requirementsMarkdown: await this.getRequirements(active.workstream.id),
      unresolvedComments: comments,
      evidence,
      repositorySummary
    });

    const reviewsFile = await this.readReviews(root);
    const id = nextAvailableId(
      "deterministic-review",
      reviewsFile.reviews.map((review) => review.id)
    );
    const now = createTimestamp();
    const review: Review = {
      id,
      sliceId: active.slice.id,
      status: result.status,
      summary: result.summary,
      comments: comments.filter((comment) => !comment.sliceId || comment.sliceId === active.slice.id),
      evidence,
      checks: result.checks,
      createdAt: now,
      updatedAt: now
    };

    reviewsFile.reviews.push(review);
    await writeJson(path.join(root, "reviews.json"), reviewsFile);

    return { review, result };
  }

  async listReviews(workstreamId: string): Promise<Review[]> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const reviewsFile = await this.readReviews(root);
    return reviewsFile.reviews;
  }

  async startReviewSession(repositorySummary: RepositorySummary): Promise<ReviewSession> {
    const active = await this.getActiveSlice();

    if (!active) {
      throw new PathfinderError("No active slice set. Use 'pathfinder slice active <workstream-id> <slice-id>' first.");
    }

    const root = await this.requireWorkstreamRoot(active.workstream.id);
    const sessionsFile = await this.readReviewSessions(root);
    const id = nextAvailableId(
      `review-${active.slice.id}`,
      sessionsFile.sessions.map((session) => session.id)
    );
    const session: ReviewSession = {
      id,
      workstreamId: active.workstream.id,
      sliceId: active.slice.id,
      baseRef: repositorySummary.baseRef,
      headRef: repositorySummary.headRef,
      headCommit: repositorySummary.headCommit,
      mergeBase: repositorySummary.mergeBase,
      changedFiles: repositorySummary.files,
      createdAt: createTimestamp()
    };

    sessionsFile.sessions.push(session);
    await writeJson(path.join(root, "review-sessions.json"), sessionsFile);
    return session;
  }

  async listReviewSessions(workstreamId: string): Promise<ReviewSession[]> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const sessionsFile = await this.readReviewSessions(root);
    return sessionsFile.sessions;
  }

  async addEvidence(
    workstreamId: string,
    sliceId: string,
    kind: string,
    description: string,
    evidencePath?: string
  ): Promise<Evidence> {
    if (!isEvidenceKind(kind)) {
      throw new PathfinderError(
        `Invalid evidence kind '${kind}'. Expected one of: test, screenshot, log, manual, benchmark, other.`
      );
    }

    const root = await this.requireWorkstreamRoot(workstreamId);
    const cleanDescription = assertNonEmptyText(description, "Evidence description");
    const slices = await this.listSlices(workstreamId);
    const slice = slices.find((candidate) => candidate.id === sliceId);

    if (!slice) {
      throw new PathfinderError(`Slice '${sliceId}' was not found in workstream '${workstreamId}'.`);
    }

    if (evidencePath && !(await exists(path.resolve(this.cwd, evidencePath)))) {
      throw new PathfinderError(`Evidence path not found: ${evidencePath}`);
    }

    const evidenceFile = await this.readEvidence(root);
    const id = nextAvailableId(
      toUrlSafeId(cleanDescription),
      evidenceFile.evidence.map((item) => item.id)
    );
    const evidence: Evidence = {
      id,
      sliceId,
      kind,
      description: cleanDescription,
      ...(evidencePath ? { path: evidencePath } : {}),
      createdAt: createTimestamp()
    };

    evidenceFile.evidence.push(evidence);
    await writeJson(path.join(root, "evidence.json"), evidenceFile);
    return evidence;
  }

  async listEvidence(workstreamId: string): Promise<Evidence[]> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const evidenceFile = await this.readEvidence(root);
    return evidenceFile.evidence;
  }

  async getReview(workstreamId: string, reviewId: string): Promise<Review> {
    const reviews = await this.listReviews(workstreamId);
    const review = reviews.find((candidate) => candidate.id === reviewId);

    if (!review) {
      throw new PathfinderError(`Review '${reviewId}' was not found in workstream '${workstreamId}'.`);
    }

    return review;
  }

  async getReviewSession(workstreamId: string, sessionId: string): Promise<ReviewSession> {
    const sessions = await this.listReviewSessions(workstreamId);
    const session = sessions.find((candidate) => candidate.id === sessionId);

    if (!session) {
      throw new PathfinderError(`Review session '${sessionId}' was not found in workstream '${workstreamId}'.`);
    }

    return session;
  }

  async findReviewSession(sessionId: string): Promise<ReviewSession> {
    const workstreams = await this.listWorkstreams();

    for (const workstream of workstreams) {
      const session = (await this.listReviewSessions(workstream.id)).find(
        (candidate) => candidate.id === sessionId
      );

      if (session) {
        return session;
      }
    }

    throw new PathfinderError(`Review session '${sessionId}' was not found.`);
  }

  async generatePrMarkdown(
    workstreamId: string,
    repositorySummary?: RepositorySummary
  ): Promise<GeneratedPrMarkdown> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const markdown = generatePrMarkdown({
      workstream: await this.getWorkstream(workstreamId),
      requirementsMarkdown: await this.getRequirements(workstreamId),
      planMarkdown: await this.getPlan(workstreamId),
      slices: await this.listSlices(workstreamId),
      comments: await this.listComments(workstreamId),
      reviews: await this.listReviews(workstreamId),
      evidence: await this.listEvidence(workstreamId),
      repositorySummary
    });
    const outputPath = path.join(root, "pr.md");

    await writeFile(outputPath, markdown, "utf8");

    return {
      markdown,
      path: outputPath
    };
  }

  async resolveComment(workstreamId: string, commentId: string): Promise<ReviewComment> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const commentsFile = await this.readComments(root);
    const comment = commentsFile.comments.find((candidate) => candidate.id === commentId);

    if (!comment) {
      throw new PathfinderError(`Comment '${commentId}' was not found in workstream '${workstreamId}'.`);
    }

    if (comment.resolved) {
      throw new PathfinderError(`Comment '${commentId}' is already resolved.`);
    }

    const resolved: ReviewComment = {
      ...comment,
      resolved: true,
      resolvedAt: createTimestamp()
    };
    commentsFile.comments = commentsFile.comments.map((candidate) =>
      candidate.id === commentId ? resolved : candidate
    );
    await writeJson(path.join(root, "comments.json"), commentsFile);
    return resolved;
  }

  async setActiveSlice(workstreamId: string, sliceId: string): Promise<ActiveSlice> {
    const stateRoot = await this.requireStateRoot();
    const root = await this.requireWorkstreamRoot(workstreamId);
    const workstream = await this.getWorkstream(workstreamId);
    const slices = await this.listSlices(workstreamId);
    const slice = slices.find((candidate) => candidate.id === sliceId);

    if (!slice) {
      throw new PathfinderError(`Slice '${sliceId}' was not found in workstream '${workstreamId}'.`);
    }

    const updatedWorkstream: Workstream = {
      ...workstream,
      activeSliceId: slice.id,
      updatedAt: createTimestamp()
    };
    await writeJson(path.join(root, "workstream.json"), updatedWorkstream);

    const project = await this.getProject();
    await writeJson(path.join(stateRoot, "project.json"), {
      ...project,
      activeWorkstreamId: workstreamId
    } satisfies Project);

    return { workstream: updatedWorkstream, slice };
  }

  async getActiveSlice(): Promise<ActiveSlice | undefined> {
    const project = await this.getProject();
    if (!project.activeWorkstreamId) {
      return undefined;
    }

    const workstream = await this.getWorkstream(project.activeWorkstreamId);
    if (!workstream.activeSliceId) {
      return undefined;
    }

    const slices = await this.listSlices(workstream.id);
    const slice = slices.find((candidate) => candidate.id === workstream.activeSliceId);
    if (!slice) {
      throw new PathfinderError(
        `Active slice '${workstream.activeSliceId}' was not found in workstream '${workstream.id}'.`
      );
    }

    return { workstream, slice };
  }

  async getCurrentContext(): Promise<CurrentContext> {
    const project = await this.getProject();

    if (!project.activeWorkstreamId) {
      return {
        project,
        unresolvedComments: [],
        evidence: []
      };
    }

    const workstream = await this.getWorkstream(project.activeWorkstreamId);
    const root = await this.requireWorkstreamRoot(workstream.id);
    const requirementsPath = path.join(root, "requirements.md");
    const requirementsMarkdown = (await exists(requirementsPath))
      ? await readFile(requirementsPath, "utf8")
      : "";
    const planPath = path.join(root, "plan.md");
    const planMarkdown = await readFile(planPath, "utf8");
    const unresolvedComments = (await this.listComments(workstream.id)).filter((comment) => !comment.resolved);
    const evidence = await this.listEvidence(workstream.id);

    if (!workstream.activeSliceId) {
      return {
        project,
        workstream,
        requirementsPath,
        requirementsMarkdown,
        planPath,
        planMarkdown,
        unresolvedComments,
        evidence: []
      };
    }

    const slices = await this.listSlices(workstream.id);
    const activeSlice = slices.find((candidate) => candidate.id === workstream.activeSliceId);
    if (!activeSlice) {
      throw new PathfinderError(
        `Active slice '${workstream.activeSliceId}' was not found in workstream '${workstream.id}'.`
      );
    }

    return {
      project,
      workstream,
      activeSlice,
      requirementsPath,
      requirementsMarkdown,
      planPath,
      planMarkdown,
      unresolvedComments,
      evidence: evidence.filter((item) => item.sliceId === activeSlice.id)
    };
  }

  private async listWorkstreamIds(): Promise<string[]> {
    const stateRoot = await this.requireStateRoot();
    const workstreamsRoot = path.join(stateRoot, "workstreams");
    if (!(await exists(workstreamsRoot))) {
      return [];
    }

    const entries = await readdir(workstreamsRoot, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  }

  private async requireStateRoot(): Promise<string> {
    const repoRoot = await findGitRoot(this.cwd);
    if (!repoRoot) {
      throw new PathfinderError("This command must be run inside a Git repository.");
    }

    const stateRoot = path.join(repoRoot, ".pathfinder");
    const projectPath = path.join(stateRoot, "project.json");
    if (!(await exists(projectPath))) {
      throw new PathfinderError("Pathfinder state not found. Run 'pathfinder init' first.");
    }

    return stateRoot;
  }

  private async requireWorkstreamRoot(workstreamId: string): Promise<string> {
    const stateRoot = await this.requireStateRoot();
    const root = path.join(stateRoot, "workstreams", workstreamId);
    const infoPath = path.join(root, "workstream.json");

    if (!(await exists(infoPath))) {
      throw new PathfinderError(`Workstream '${workstreamId}' was not found.`);
    }

    return root;
  }

  private async readSlices(workstreamRoot: string): Promise<SlicesFile> {
    return readJson<SlicesFile>(path.join(workstreamRoot, "slices.json"));
  }

  private async updateSlice(
    workstreamId: string,
    sliceId: string,
    update: (slice: Slice) => Slice
  ): Promise<Slice> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const slicesFile = await this.readSlices(root);
    const index = slicesFile.slices.findIndex((candidate) => candidate.id === sliceId);

    if (index === -1) {
      throw new PathfinderError(`Slice '${sliceId}' was not found in workstream '${workstreamId}'.`);
    }

    const updated = update(slicesFile.slices[index]);
    slicesFile.slices[index] = updated;
    await writeJson(path.join(root, "slices.json"), slicesFile);
    return updated;
  }

  private async readComments(workstreamRoot: string): Promise<CommentsFile> {
    return readJson<CommentsFile>(path.join(workstreamRoot, "comments.json"));
  }

  private async readReviews(workstreamRoot: string): Promise<ReviewsFile> {
    return readJson<ReviewsFile>(path.join(workstreamRoot, "reviews.json"));
  }

  private async readReviewSessions(workstreamRoot: string): Promise<ReviewSessionsFile> {
    const filePath = path.join(workstreamRoot, "review-sessions.json");
    if (!(await exists(filePath))) {
      return { sessions: [] };
    }

    return readJson<ReviewSessionsFile>(filePath);
  }

  private async readEvidence(workstreamRoot: string): Promise<EvidenceFile> {
    const filePath = path.join(workstreamRoot, "evidence.json");
    if (!(await exists(filePath))) {
      return { evidence: [] };
    }

    return readJson<EvidenceFile>(filePath);
  }
}
