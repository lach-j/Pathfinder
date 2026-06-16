import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  BranchReviewSession,
  BranchReviewNextRecommendation,
  DeterministicReviewResult,
  Evidence,
  AGENT_COMMAND_MANAGED_END,
  AGENT_COMMAND_MANAGED_START,
  AGENT_USER_INSTALL_MANAGED_END,
  AGENT_USER_INSTALL_MANAGED_START,
  AgentCommandTool,
  AgentCommandToolDefinition,
  AgentRepositoryCheckSignals,
  AgentNextRecommendation,
  AgentPromptPhase,
  AgentUserInstallTool,
  AgentUserInstallToolDefinition,
  ImportedStagePlan,
  PathfinderError,
  Project,
  RepositorySummary,
  Review,
  ReviewComment,
  ReviewCommentOrigin,
  ReviewCommentTarget,
  ReviewSession,
  Slice,
  SliceStatus,
  StructuredDiff,
  Workstream,
  assertNonEmptyText,
  createOpaqueReviewCommentId,
  createTimestamp,
  findNextActionableSlice,
  getAgentCommandToolDefinitions,
  getAgentCheckGuidance,
  getAgentNextRecommendation,
  getAgentUserInstallToolDefinitions,
  getBranchReviewNextRecommendation,
  generateBranchFeedbackQueueMarkdown,
  generateBranchPrMarkdown,
  generateDeterministicReview,
  generateFeedbackQueueMarkdown,
  generatePrMarkdown,
  getReviewCommentAnchorStatus,
  renderAgentPrompt,
  isEvidenceKind,
  isReviewCommentSide,
  isSliceStatus,
  nextAvailableId,
  parseStagePlanMarkdown,
  structuredDiffHasFile,
  structuredDiffHasLine,
  toUrlSafeId
} from "@pathfinder/core";

import { exists } from "./file-system.js";
import { findGitRoot } from "./git-root.js";
import { readJson, writeJson } from "./json-file.js";
import { validateDependencies } from "./slice-dependencies.js";
import {
  PathfinderStoreOptions,
  resolveExistingStateRoot,
  resolveStateRootForInit,
  writeExternalProjectMetadata
} from "./state-root.js";

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

export interface StoredMarkdownFile {
  markdown: string;
  path: string;
}

export interface FeedbackQueueExport {
  markdown: string;
  defaultPath?: string;
}

export interface AgentBootstrapResult {
  path: string;
  markdown: string;
  changed: boolean;
  dryRun: boolean;
}

export interface AgentCommandFileResult {
  tool: AgentCommandTool;
  commandName: string;
  path: string;
  relativePath: string;
  installed: boolean;
  managed: boolean;
  changed: boolean;
  skipped: boolean;
  reason?: string;
}

export interface AgentCommandsInstallResult {
  dryRun: boolean;
  files: AgentCommandFileResult[];
}

export interface AgentCommandsListResult {
  tools: {
    tool: AgentCommandTool;
    displayName: string;
    files: AgentCommandFileResult[];
  }[];
}

export interface AgentUserInstallFileResult {
  tool: AgentUserInstallTool;
  path: string;
  relativePath: string;
  installed: boolean;
  managed: boolean;
  changed: boolean;
  skipped: boolean;
  reason?: string;
}

export interface AgentUserInstallResult {
  dryRun: boolean;
  files: AgentUserInstallFileResult[];
  manualInstructions: {
    tool: AgentUserInstallTool;
    displayName: string;
    instructions: string[];
  }[];
}

export type AgentDoctorCheckStatus = "pass" | "missing" | "warning" | "error";

export interface AgentDoctorCheck {
  id: string;
  status: AgentDoctorCheckStatus;
  message: string;
  fixCommand?: string;
}

export interface AgentDoctorResult {
  ok: boolean;
  checks: AgentDoctorCheck[];
  next: {
    phase: AgentNextRecommendation["phase"];
    command: "pathfinder agent next --json";
  };
}

export interface AgentDoctorOptions {
  personal?: boolean;
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

export type RepositorySummaryProvider = (baseRef: string) => Promise<RepositorySummary>;
export type SuggestedBaseRefProvider = () => Promise<string | undefined>;
export type UncommittedChangesProvider = () => Promise<boolean>;

export interface AddCommentInput {
  body: string;
  origin?: ReviewCommentOrigin;
  target?: ReviewCommentTarget;
  structuredDiff?: StructuredDiff;
}

export interface ListCommentsOptions {
  sessionId?: string;
  openOnly?: boolean;
}

export interface ExportFeedbackOptions {
  sessionId?: string;
}

export interface InitProjectOptions {
  personal?: boolean;
}

export interface RefreshedReviewSession {
  session: ReviewSession;
  comments: ReviewComment[];
}

export interface RefreshedBranchReviewSession {
  session: BranchReviewSession;
  comments: ReviewComment[];
}

export interface ReviewApprovalResult {
  session: ReviewSession;
  slice: Slice;
  evidence: Evidence;
}

export interface BranchReviewApprovalResult {
  session: BranchReviewSession;
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

interface BranchReviewSessionsFile {
  sessions: BranchReviewSession[];
}

interface EvidenceFile {
  evidence: Evidence[];
}

interface ValidatedCommentTarget {
  target: ReviewCommentTarget;
  sliceId?: string;
}

export class PathfinderStore {
  private readonly cwd: string;
  private readonly options: PathfinderStoreOptions;

  constructor(cwd: string = process.cwd(), options: PathfinderStoreOptions = {}) {
    this.cwd = path.resolve(cwd);
    this.options = options;
  }

  async initProject(options: InitProjectOptions = {}): Promise<Project> {
    const mode = options.personal ? "external" : "repo";
    const resolution = await resolveStateRootForInit(this.cwd, mode, this.options).catch((error) => {
      if (error instanceof PathfinderError && error.message === "This command must be run inside a Git repository.") {
        throw new PathfinderError("pathfinder init must be run inside a Git repository.");
      }
      throw error;
    });
    const stateRoot = resolution.stateRoot;
    const projectPath = path.join(stateRoot, "project.json");

    if (await exists(projectPath)) {
      throw new PathfinderError(
        mode === "external"
          ? "External Pathfinder state already exists for this repository."
          : "Pathfinder state already exists in this repository."
      );
    }

    if (mode === "external" && await exists(path.join(resolution.gitRoot, ".pathfinder", "project.json"))) {
      throw new PathfinderError(
        "Cannot initialise external Pathfinder state because repo-local .pathfinder/project.json already exists. Pathfinder will use the existing repo-local state."
      );
    }

    const now = createTimestamp();
    const project: Project = {
      schemaVersion: 1,
      name: path.basename(resolution.gitRoot),
      createdAt: now
    };

    await mkdir(path.join(stateRoot, "workstreams"), { recursive: true });
    await writeJson(projectPath, project);

    if (mode === "external" && resolution.projectIdentity) {
      await writeExternalProjectMetadata(stateRoot, resolution.projectIdentity);
    }

    return project;
  }

  async bootstrapAgentInstructions(options: { dryRun?: boolean } = {}): Promise<AgentBootstrapResult> {
    const gitRoot = await findGitRoot(this.cwd);
    if (!gitRoot) {
      throw new PathfinderError("Agent bootstrap must be run inside a Git repository.");
    }

    const agentsPath = path.join(gitRoot, "AGENTS.md");
    const existing = (await exists(agentsPath)) ? await readFile(agentsPath, "utf8") : "";
    const markdown = applyAgentBootstrapBlock(existing);
    const changed = markdown !== existing;
    const dryRun = Boolean(options.dryRun);

    if (!dryRun && changed) {
      await writeFile(agentsPath, markdown, "utf8");
    }

    return {
      path: agentsPath,
      markdown,
      changed,
      dryRun
    };
  }

  async installAgentCommands(options: { tool?: AgentCommandTool; dryRun?: boolean } = {}): Promise<AgentCommandsInstallResult> {
    const gitRoot = await this.requireGitRootForAgentCommands();
    const dryRun = Boolean(options.dryRun);
    const definitions = getAgentCommandToolDefinitions(options.tool);
    const files: AgentCommandFileResult[] = [];

    for (const definition of definitions) {
      for (const file of definition.files) {
        const result = await this.planAgentCommandFile(gitRoot, file);

        if (!dryRun && !result.skipped && result.changed) {
          await mkdir(path.dirname(result.path), { recursive: true });
          await writeFile(result.path, file.markdown, "utf8");
        }

        files.push(result);
      }
    }

    return { dryRun, files };
  }

  async installUserAgentIntegration(options: {
    tool?: AgentUserInstallTool;
    dryRun?: boolean;
  } = {}): Promise<AgentUserInstallResult> {
    const dryRun = Boolean(options.dryRun);
    const definitions = getAgentUserInstallToolDefinitions(options.tool);
    const files: AgentUserInstallFileResult[] = [];
    const manualInstructions: AgentUserInstallResult["manualInstructions"] = [];

    for (const definition of definitions) {
      for (const file of definition.files) {
        const result = await this.planUserAgentInstallFile(file);

        if (!dryRun && !result.skipped && result.changed) {
          await mkdir(path.dirname(result.path), { recursive: true });
          await writeFile(result.path, result.markdown, "utf8");
        }

        const { markdown: _markdown, ...publicResult } = result;
        files.push(publicResult);
      }

      if (definition.manualInstructions.length > 0) {
        manualInstructions.push({
          tool: definition.tool,
          displayName: definition.displayName,
          instructions: definition.manualInstructions
        });
      }
    }

    return { dryRun, files, manualInstructions };
  }

  async listAgentCommands(): Promise<AgentCommandsListResult> {
    const gitRoot = await this.requireGitRootForAgentCommands();
    const tools = await Promise.all(
      getAgentCommandToolDefinitions().map(async (definition) => ({
        tool: definition.tool,
        displayName: definition.displayName,
        files: await Promise.all(definition.files.map((file) => this.planAgentCommandFile(gitRoot, file)))
      }))
    );

    return { tools };
  }

  async getAgentDoctor(
    provider?: RepositorySummaryProvider,
    uncommittedChangesProviderOrOptions?: UncommittedChangesProvider | AgentDoctorOptions,
    maybeOptions: AgentDoctorOptions = {}
  ): Promise<AgentDoctorResult> {
    const uncommittedChangesProvider = typeof uncommittedChangesProviderOrOptions === "function"
      ? uncommittedChangesProviderOrOptions
      : undefined;
    const options = typeof uncommittedChangesProviderOrOptions === "function"
      ? maybeOptions
      : (uncommittedChangesProviderOrOptions ?? {});
    const gitRoot = await findGitRoot(this.cwd);
    if (!gitRoot) {
      throw new PathfinderError("Agent doctor must be run inside a Git repository.");
    }

    const checks = options.personal
      ? await this.getPersonalAgentDoctorChecks(gitRoot)
      : [
          await this.checkPathfinderProject(gitRoot),
          await this.checkAgentBootstrap(gitRoot)
        ];

    if (!options.personal) {
      const commandStatus = await this.listAgentCommands();
      for (const tool of commandStatus.tools) {
        checks.push(checkAgentCommandTool(tool));
      }
    }

    const nextCheck = await this.checkAgentNext(provider, uncommittedChangesProvider);
    checks.push(nextCheck.check);

    return {
      ok: checks.every((check) => check.status === "pass"),
      checks,
      next: {
        phase: nextCheck.phase,
        command: "pathfinder agent next --json"
      }
    };
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
    return (await this.getRequirementsDocument(workstreamId)).markdown;
  }

  async getRequirementsDocument(workstreamId: string): Promise<StoredMarkdownFile> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const requirementsPath = path.join(root, "requirements.md");

    if (!(await exists(requirementsPath))) {
      return {
        markdown: "",
        path: requirementsPath
      };
    }

    return {
      markdown: await readFile(requirementsPath, "utf8"),
      path: requirementsPath
    };
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
    return (await this.getPlanDocument(workstreamId)).markdown;
  }

  async getPlanDocument(workstreamId: string): Promise<StoredMarkdownFile> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const planPath = path.join(root, "plan.md");

    if (!(await exists(planPath))) {
      return {
        markdown: "",
        path: planPath
      };
    }

    return {
      markdown: await readFile(planPath, "utf8"),
      path: planPath
    };
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

  async addComment(workstreamId: string, sliceId: string, body: string): Promise<ReviewComment>;
  async addComment(workstreamId: string, input: AddCommentInput): Promise<ReviewComment>;
  async addComment(
    workstreamId: string,
    sliceIdOrInput: string | AddCommentInput,
    body?: string
  ): Promise<ReviewComment> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const input = typeof sliceIdOrInput === "string"
      ? {
          body: body ?? "",
          target: {
            type: "slice",
            sliceId: sliceIdOrInput
          } satisfies ReviewCommentTarget
        }
      : sliceIdOrInput;
    const cleanBody = assertNonEmptyText(input.body, "Comment body");
    const validatedTarget = await this.validateCommentTarget(workstreamId, input.target, input.structuredDiff);

    const commentsFile = await this.readComments(root);
    const id = createOpaqueReviewCommentId(commentsFile.comments.map((comment) => comment.id));
    const comment: ReviewComment = {
      id,
      ...(validatedTarget.sliceId ? { sliceId: validatedTarget.sliceId } : {}),
      target: validatedTarget.target,
      origin: input.origin ?? "human",
      body: cleanBody,
      resolved: false,
      createdAt: createTimestamp()
    };

    commentsFile.comments.push(comment);
    await writeJson(path.join(root, "comments.json"), commentsFile);
    return comment;
  }

  async listComments(workstreamId: string, options: ListCommentsOptions = {}): Promise<ReviewComment[]> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const commentsFile = await this.readComments(root);
    return commentsFile.comments.filter((comment) => {
      if (options.openOnly && comment.resolved) {
        return false;
      }

      if (options.sessionId && !commentTargetsSession(comment, options.sessionId)) {
        return false;
      }

      return true;
    });
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

  async refreshReviewSession(
    workstreamId: string,
    sessionId: string,
    repositorySummary: RepositorySummary,
    structuredDiff: StructuredDiff
  ): Promise<RefreshedReviewSession> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const sessionsFile = await this.readReviewSessions(root);
    const sessionIndex = sessionsFile.sessions.findIndex((candidate) => candidate.id === sessionId);

    if (sessionIndex === -1) {
      throw new PathfinderError(`Review session '${sessionId}' was not found in workstream '${workstreamId}'.`);
    }

    const existingSession = sessionsFile.sessions[sessionIndex];
    const refreshedSession: ReviewSession = {
      ...existingSession,
      baseRef: repositorySummary.baseRef,
      headRef: repositorySummary.headRef,
      headCommit: repositorySummary.headCommit,
      mergeBase: repositorySummary.mergeBase,
      changedFiles: repositorySummary.files,
      refreshedAt: createTimestamp()
    };
    sessionsFile.sessions[sessionIndex] = refreshedSession;

    const commentsFile = await this.readComments(root);
    const refreshedComments = commentsFile.comments.map((comment) => {
      if (!commentTargetsSession(comment, sessionId)) {
        return comment;
      }

      return {
        ...comment,
        anchorStatus: getReviewCommentAnchorStatus(comment, sessionId, structuredDiff)
      };
    });
    commentsFile.comments = refreshedComments;

    await writeJson(path.join(root, "review-sessions.json"), sessionsFile);
    await writeJson(path.join(root, "comments.json"), commentsFile);

    return {
      session: refreshedSession,
      comments: refreshedComments.filter((comment) => commentTargetsSession(comment, sessionId))
    };
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

  async approveReviewSession(workstreamId: string, sessionId: string): Promise<ReviewApprovalResult> {
    const active = await this.getActiveSlice();

    if (!active) {
      throw new PathfinderError("No active slice set. Use 'pathfinder slice active <workstream-id> <slice-id>' first.");
    }

    if (active.workstream.id !== workstreamId) {
      throw new PathfinderError(
        `Review session approval requires the active workstream '${active.workstream.id}', but '${workstreamId}' was provided.`
      );
    }

    const session = await this.getReviewSession(workstreamId, sessionId);

    if (session.sliceId !== active.slice.id) {
      throw new PathfinderError(
        `Review session '${sessionId}' belongs to slice '${session.sliceId}', but active slice is '${active.slice.id}'.`
      );
    }

    const openSessionComments = await this.listComments(workstreamId, {
      sessionId,
      openOnly: true
    });

    if (openSessionComments.length > 0) {
      throw new PathfinderError(
        `Cannot approve review session '${sessionId}' while ${openSessionComments.length} open review comment(s) remain. Resolve or address them first.`
      );
    }

    const evidence = await this.addEvidence(
      workstreamId,
      active.slice.id,
      "manual",
      `Human approved review session ${sessionId}.`
    );
    const slice = await this.updateSliceStatus(workstreamId, active.slice.id, "complete");

    return { session, slice, evidence };
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

  async startBranchReviewSession(repositorySummary: RepositorySummary): Promise<BranchReviewSession> {
    const root = await this.ensureBranchReviewRoot();
    const sessionsFile = await this.readBranchReviewSessions(root);
    const id = nextAvailableId(
      `review-${toUrlSafeId(repositorySummary.headRef)}`,
      sessionsFile.sessions.map((session) => session.id)
    );
    const session: BranchReviewSession = {
      id,
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

  async listBranchReviewSessions(): Promise<BranchReviewSession[]> {
    const root = await this.getBranchReviewRoot();
    const sessionsFile = await this.readBranchReviewSessions(root);
    return sessionsFile.sessions;
  }

  async getBranchReviewSession(sessionId: string): Promise<BranchReviewSession> {
    const sessions = await this.listBranchReviewSessions();
    const session = sessions.find((candidate) => candidate.id === sessionId);

    if (!session) {
      throw new PathfinderError(`Branch review session '${sessionId}' was not found.`);
    }

    return session;
  }

  async refreshBranchReviewSession(
    sessionId: string,
    repositorySummary: RepositorySummary,
    structuredDiff: StructuredDiff
  ): Promise<RefreshedBranchReviewSession> {
    const root = await this.ensureBranchReviewRoot();
    const sessionsFile = await this.readBranchReviewSessions(root);
    const sessionIndex = sessionsFile.sessions.findIndex((candidate) => candidate.id === sessionId);

    if (sessionIndex === -1) {
      throw new PathfinderError(`Branch review session '${sessionId}' was not found.`);
    }

    const existingSession = sessionsFile.sessions[sessionIndex];
    const refreshedSession: BranchReviewSession = {
      ...existingSession,
      baseRef: repositorySummary.baseRef,
      headRef: repositorySummary.headRef,
      headCommit: repositorySummary.headCommit,
      mergeBase: repositorySummary.mergeBase,
      changedFiles: repositorySummary.files,
      refreshedAt: createTimestamp()
    };
    delete refreshedSession.approvedAt;
    sessionsFile.sessions[sessionIndex] = refreshedSession;

    const commentsFile = await this.readBranchReviewComments(root);
    const refreshedComments = commentsFile.comments.map((comment) => {
      if (!commentTargetsSession(comment, sessionId)) {
        return comment;
      }

      return {
        ...comment,
        anchorStatus: getReviewCommentAnchorStatus(comment, sessionId, structuredDiff)
      };
    });
    commentsFile.comments = refreshedComments;

    await writeJson(path.join(root, "review-sessions.json"), sessionsFile);
    await writeJson(path.join(root, "comments.json"), commentsFile);

    return {
      session: refreshedSession,
      comments: refreshedComments.filter((comment) => commentTargetsSession(comment, sessionId))
    };
  }

  async addBranchReviewComment(input: AddCommentInput): Promise<ReviewComment> {
    const root = await this.ensureBranchReviewRoot();
    const cleanBody = assertNonEmptyText(input.body, "Comment body");
    const target = await this.validateBranchReviewCommentTarget(input.target, input.structuredDiff);
    const commentsFile = await this.readBranchReviewComments(root);
    const id = createOpaqueReviewCommentId(commentsFile.comments.map((comment) => comment.id));
    const comment: ReviewComment = {
      id,
      target,
      origin: input.origin ?? "human",
      body: cleanBody,
      resolved: false,
      createdAt: createTimestamp()
    };

    commentsFile.comments.push(comment);
    await writeJson(path.join(root, "comments.json"), commentsFile);
    return comment;
  }

  async listBranchReviewComments(options: ListCommentsOptions = {}): Promise<ReviewComment[]> {
    const root = await this.getBranchReviewRoot();
    const commentsFile = await this.readBranchReviewComments(root);
    return commentsFile.comments.filter((comment) => {
      if (options.openOnly && comment.resolved) {
        return false;
      }

      if (options.sessionId && !commentTargetsSession(comment, options.sessionId)) {
        return false;
      }

      return true;
    });
  }

  async resolveBranchReviewComment(commentId: string): Promise<ReviewComment> {
    const root = await this.ensureBranchReviewRoot();
    const commentsFile = await this.readBranchReviewComments(root);
    const comment = commentsFile.comments.find((candidate) => candidate.id === commentId);

    if (!comment) {
      throw new PathfinderError(`Branch review comment '${commentId}' was not found.`);
    }

    if (comment.resolved) {
      throw new PathfinderError(`Branch review comment '${commentId}' is already resolved.`);
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

  async approveBranchReviewSession(sessionId: string): Promise<BranchReviewApprovalResult> {
    const root = await this.ensureBranchReviewRoot();
    const sessionsFile = await this.readBranchReviewSessions(root);
    const sessionIndex = sessionsFile.sessions.findIndex((candidate) => candidate.id === sessionId);

    if (sessionIndex === -1) {
      throw new PathfinderError(`Branch review session '${sessionId}' was not found.`);
    }

    const openSessionComments = await this.listBranchReviewComments({
      sessionId,
      openOnly: true
    });

    if (openSessionComments.length > 0) {
      throw new PathfinderError(
        `Cannot approve branch review session '${sessionId}' while ${openSessionComments.length} open review comment(s) remain. Resolve or address them first.`
      );
    }

    const session: BranchReviewSession = {
      ...sessionsFile.sessions[sessionIndex],
      approvedAt: createTimestamp()
    };
    sessionsFile.sessions[sessionIndex] = session;
    await writeJson(path.join(root, "review-sessions.json"), sessionsFile);

    return { session };
  }

  async exportBranchReviewFeedbackQueue(options: ExportFeedbackOptions = {}): Promise<FeedbackQueueExport> {
    const session = options.sessionId ? await this.getBranchReviewSession(options.sessionId) : undefined;
    const comments = await this.listBranchReviewComments({
      sessionId: options.sessionId,
      openOnly: true
    }).then((items) => items.filter((comment) => comment.origin !== "agent"));

    return {
      markdown: generateBranchFeedbackQueueMarkdown({
        session,
        comments
      }),
      defaultPath: await this.getDefaultBranchFeedbackQueuePath()
    };
  }

  async generateBranchReviewPrMarkdown(repositorySummary?: RepositorySummary): Promise<GeneratedPrMarkdown> {
    const root = await this.ensureBranchReviewRoot();
    const feedbackQueuePath = await this.getExistingBranchFeedbackQueuePath();
    const markdown = generateBranchPrMarkdown({
      sessions: await this.listBranchReviewSessions(),
      comments: await this.listBranchReviewComments(),
      repositorySummary,
      feedbackQueuePath
    });
    const outputPath = path.join(root, "pr.md");

    await writeFile(outputPath, markdown, "utf8");

    return {
      markdown,
      path: outputPath
    };
  }

  async getStoredBranchReviewPrMarkdown(): Promise<StoredMarkdownFile> {
    const root = await this.getBranchReviewRoot();
    const prPath = path.join(root, "pr.md");

    if (!(await exists(prPath))) {
      return {
        markdown: "",
        path: prPath
      };
    }

    return {
      markdown: await readFile(prPath, "utf8"),
      path: prPath
    };
  }

  async generatePrMarkdown(
    workstreamId: string,
    repositorySummary?: RepositorySummary
  ): Promise<GeneratedPrMarkdown> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const resolution = await resolveExistingStateRoot(this.cwd, this.options);
    const conventionalFeedbackPath = path.join(path.dirname(resolution.stateRoot), ".pathfinder-feedback.md");
    const externalFeedbackPath = path.join(resolution.stateRoot, ".pathfinder-feedback.md");
    const feedbackQueuePath =
      resolution.mode === "external" && await exists(externalFeedbackPath)
        ? externalFeedbackPath
        : (await exists(conventionalFeedbackPath)) ? ".pathfinder-feedback.md" : undefined;
    const markdown = generatePrMarkdown({
      workstream: await this.getWorkstream(workstreamId),
      requirementsMarkdown: await this.getRequirements(workstreamId),
      planMarkdown: await this.getPlan(workstreamId),
      slices: await this.listSlices(workstreamId),
      comments: await this.listComments(workstreamId),
      reviews: await this.listReviews(workstreamId),
      reviewSessions: await this.listReviewSessions(workstreamId),
      evidence: await this.listEvidence(workstreamId),
      repositorySummary,
      feedbackQueuePath
    });
    const outputPath = path.join(root, "pr.md");

    await writeFile(outputPath, markdown, "utf8");

    return {
      markdown,
      path: outputPath
    };
  }

  async getStoredPrMarkdown(workstreamId: string): Promise<StoredMarkdownFile> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const prPath = path.join(root, "pr.md");

    if (!(await exists(prPath))) {
      return {
        markdown: "",
        path: prPath
      };
    }

    return {
      markdown: await readFile(prPath, "utf8"),
      path: prPath
    };
  }

  async exportFeedbackQueue(
    workstreamId: string,
    options: ExportFeedbackOptions = {}
  ): Promise<FeedbackQueueExport> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const workstream = await this.getWorkstream(workstreamId);
    const slices = await this.listSlices(workstreamId);
    const activeSlice = workstream.activeSliceId
      ? slices.find((candidate) => candidate.id === workstream.activeSliceId)
      : undefined;
    const session = options.sessionId ? await this.getReviewSession(workstreamId, options.sessionId) : undefined;
    const comments = await this.listComments(workstreamId, {
      sessionId: options.sessionId,
      openOnly: true
    }).then((items) => items.filter((comment) => comment.origin !== "agent"));

    return {
      markdown: generateFeedbackQueueMarkdown({
        workstream,
        activeSlice,
        requirementsPath: path.join(root, "requirements.md"),
        planPath: path.join(root, "plan.md"),
        session,
        comments,
        slices
      }),
      defaultPath: await this.getDefaultFeedbackQueuePath()
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

  async getAgentNext(
    provider?: RepositorySummaryProvider,
    suggestedBaseRefProvider?: SuggestedBaseRefProvider,
    uncommittedChangesProvider?: UncommittedChangesProvider
  ): Promise<AgentNextRecommendation> {
    let project: Project;
    try {
      project = await this.getProject();
    } catch (error) {
      if (error instanceof PathfinderError && error.message.includes("Pathfinder state not found")) {
        return getAgentNextRecommendation({
          isInitialized: false,
          workstreams: []
        });
      }

      return getAgentNextRecommendation({
        isInitialized: false,
        workstreams: [],
        stateError: errorMessage(error)
      });
    }

    const workstreams = await this.listWorkstreams();
    let activeWorkstream: Workstream | undefined;

    try {
      activeWorkstream = await this.resolveAgentWorkstream(project, workstreams);
    } catch (error) {
      return getAgentNextRecommendation({
        isInitialized: true,
        workstreams,
        stateError: errorMessage(error)
      });
    }

    if (!activeWorkstream) {
      return getAgentNextRecommendation({
        isInitialized: true,
        workstreams
      });
    }

    const slices = await this.listSlices(activeWorkstream.id);
    const activeSlice = activeWorkstream.activeSliceId
      ? slices.find((slice) => slice.id === activeWorkstream.activeSliceId)
      : undefined;
    const reviewSessions = await this.listReviewSessions(activeWorkstream.id);
    const knownBaseRef = activeSlice?.baseRef ?? latestSessionForSlice(reviewSessions, activeSlice?.id)?.baseRef;
    const repository = knownBaseRef && provider ? await this.tryGetRepositorySummary(provider, knownBaseRef) : {};
    const hasUncommittedChanges = activeSlice && uncommittedChangesProvider
      ? await this.tryGetUncommittedChanges(uncommittedChangesProvider)
      : undefined;
    const suggestedBaseRef = !activeSlice && suggestedBaseRefProvider
      ? await this.tryGetSuggestedBaseRef(suggestedBaseRefProvider)
      : undefined;

    return getAgentNextRecommendation({
      isInitialized: true,
      workstreams,
      activeWorkstream,
      slices,
      activeSlice,
      nextSlice: findNextActionableSlice(slices),
      planMarkdown: await this.getPlan(activeWorkstream.id),
      openComments: (await this.listComments(activeWorkstream.id)).filter((comment) => !comment.resolved),
      reviewSessions,
      hasUncommittedChanges,
      suggestedBaseRef,
      feedbackQueuePath: await this.getDefaultFeedbackQueuePath(),
      ...repository
    });
  }

  async getBranchReviewNext(
    provider?: RepositorySummaryProvider,
    suggestedBaseRefProvider?: SuggestedBaseRefProvider,
    uncommittedChangesProvider?: UncommittedChangesProvider
  ): Promise<BranchReviewNextRecommendation> {
    try {
      await this.getProject();
    } catch (error) {
      if (error instanceof PathfinderError && error.message.includes("Pathfinder state not found")) {
        return getBranchReviewNextRecommendation({
          isInitialized: false,
          sessions: []
        });
      }

      return getBranchReviewNextRecommendation({
        isInitialized: false,
        sessions: [],
        stateError: errorMessage(error)
      });
    }

    const sessions = await this.listBranchReviewSessions();
    const latestSession = latestBranchReviewSession(sessions);
    const knownBaseRef = latestSession?.baseRef;
    const repository = knownBaseRef && provider ? await this.tryGetRepositorySummary(provider, knownBaseRef) : {};
    const suggestedBaseRef = !latestSession && suggestedBaseRefProvider
      ? await this.tryGetSuggestedBaseRef(suggestedBaseRefProvider)
      : undefined;
    const hasUncommittedChanges = uncommittedChangesProvider
      ? await this.tryGetUncommittedChanges(uncommittedChangesProvider)
      : undefined;
    const pr = await this.getStoredBranchReviewPrMarkdown();

    return getBranchReviewNextRecommendation({
      isInitialized: true,
      sessions,
      openComments: (await this.listBranchReviewComments()).filter((comment) => !comment.resolved),
      hasUncommittedChanges,
      suggestedBaseRef,
      feedbackQueuePath: await this.getDefaultBranchFeedbackQueuePath(),
      prMarkdown: pr.markdown,
      ...repository
    });
  }

  async getAgentPrompt(
    phase?: AgentPromptPhase,
    provider?: RepositorySummaryProvider,
    suggestedBaseRefProvider?: SuggestedBaseRefProvider,
    uncommittedChangesProvider?: UncommittedChangesProvider
  ): Promise<string> {
    const recommendation = await this.getAgentNext(provider, suggestedBaseRefProvider, uncommittedChangesProvider);
    const workstreamId = recommendation.workstreamId;

    if (!workstreamId || workstreamId.startsWith("<")) {
      return renderAgentPrompt({
        phase,
        recommendation,
        checkGuidance: getAgentCheckGuidance(await this.getAgentRepositoryCheckSignals())
      });
    }

    try {
      const workstream = await this.getWorkstream(workstreamId);
      const slices = await this.listSlices(workstreamId);
      const activeSliceId = recommendation.sliceId ?? workstream.activeSliceId;
      const activeSlice = activeSliceId && !activeSliceId.startsWith("<")
        ? slices.find((slice) => slice.id === activeSliceId)
        : undefined;
      const root = await this.requireWorkstreamRoot(workstreamId);

      return renderAgentPrompt({
        phase,
        recommendation,
        workstream,
        activeSlice,
        requirementsPath: path.join(root, "requirements.md"),
        planPath: path.join(root, "plan.md"),
        feedbackQueuePath: await this.getDefaultFeedbackQueuePath(),
        checkGuidance: getAgentCheckGuidance(await this.getAgentRepositoryCheckSignals())
      });
    } catch {
      return renderAgentPrompt({
        phase,
        recommendation,
        checkGuidance: getAgentCheckGuidance(await this.getAgentRepositoryCheckSignals())
      });
    }
  }

  private async getAgentRepositoryCheckSignals(): Promise<AgentRepositoryCheckSignals> {
    const hasPackageJson = await exists(path.join(this.cwd, "package.json"));
    const hasPyproject = await exists(path.join(this.cwd, "pyproject.toml"));
    const hasSetupPy = await exists(path.join(this.cwd, "setup.py"));
    const hasSetupCfg = await exists(path.join(this.cwd, "setup.cfg"));
    const hasRequirements = await exists(path.join(this.cwd, "requirements.txt"));
    const hasPytestIni = await exists(path.join(this.cwd, "pytest.ini"));
    const hasToxIni = await exists(path.join(this.cwd, "tox.ini"));
    const hasTestsDirectory = await exists(path.join(this.cwd, "tests"));

    return {
      hasPackageJson,
      hasPythonProjectMarker: hasPyproject || hasSetupPy || hasSetupCfg || hasRequirements || hasPytestIni || hasToxIni,
      hasPythonTests: hasTestsDirectory,
      hasPytestConfig: hasPytestIni || hasToxIni,
      hasRuffConfig: await this.hasRuffConfig(hasPyproject, hasSetupCfg)
    };
  }

  private async hasRuffConfig(hasPyproject: boolean, hasSetupCfg: boolean): Promise<boolean> {
    if (await exists(path.join(this.cwd, "ruff.toml")) || await exists(path.join(this.cwd, ".ruff.toml"))) {
      return true;
    }

    if (hasPyproject && (await readFile(path.join(this.cwd, "pyproject.toml"), "utf8")).includes("[tool.ruff")) {
      return true;
    }

    return hasSetupCfg && (await readFile(path.join(this.cwd, "setup.cfg"), "utf8")).includes("[ruff]");
  }

  private async validateCommentTarget(
    workstreamId: string,
    target: ReviewCommentTarget | undefined,
    structuredDiff: StructuredDiff | undefined
  ): Promise<ValidatedCommentTarget> {
    if (!target) {
      return {
        target: { type: "workstream" }
      };
    }

    if (target.type === "workstream") {
      return { target };
    }

    if (target.type === "slice") {
      const slices = await this.listSlices(workstreamId);
      const slice = slices.find((candidate) => candidate.id === target.sliceId);

      if (!slice) {
        throw new PathfinderError(`Slice '${target.sliceId}' was not found in workstream '${workstreamId}'.`);
      }

      return {
        target,
        sliceId: target.sliceId
      };
    }

    const session = await this.getReviewSession(workstreamId, target.sessionId);
    if (!session.changedFiles.some((file) => changedFileMatches(file.path, file.previousPath, target.filePath))) {
      throw new PathfinderError(
        `File '${target.filePath}' was not found in review session '${target.sessionId}'.`
      );
    }

    if (structuredDiff && !structuredDiffHasFile(structuredDiff, target.filePath)) {
      throw new PathfinderError(
        `File '${target.filePath}' was not found in the parsed diff for review session '${target.sessionId}'.`
      );
    }

    if (target.type === "file") {
      return {
        target,
        sliceId: session.sliceId
      };
    }

    if (!Number.isInteger(target.lineNumber) || target.lineNumber < 1) {
      throw new PathfinderError("Comment line number must be a positive integer.");
    }

    if (!isReviewCommentSide(target.side)) {
      throw new PathfinderError("Invalid comment side. Expected old or new.");
    }

    if (structuredDiff && !structuredDiffHasLine(structuredDiff, target.filePath, target.lineNumber, target.side)) {
      throw new PathfinderError(
        `Line ${target.lineNumber} (${target.side}) was not found for '${target.filePath}' in review session '${target.sessionId}'.`
      );
    }

    return {
      target,
      sliceId: session.sliceId
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
    return (await resolveExistingStateRoot(this.cwd, this.options)).stateRoot;
  }

  private async getDefaultFeedbackQueuePath(): Promise<string | undefined> {
    const resolution = await resolveExistingStateRoot(this.cwd, this.options);
    return resolution.mode === "external" ? path.join(resolution.stateRoot, ".pathfinder-feedback.md") : undefined;
  }

  private async getDefaultBranchFeedbackQueuePath(): Promise<string | undefined> {
    const resolution = await resolveExistingStateRoot(this.cwd, this.options);
    return resolution.mode === "external"
      ? path.join(resolution.stateRoot, ".pathfinder-branch-feedback.md")
      : undefined;
  }

  private async getExistingBranchFeedbackQueuePath(): Promise<string | undefined> {
    const resolution = await resolveExistingStateRoot(this.cwd, this.options);
    const conventionalFeedbackPath = path.join(path.dirname(resolution.stateRoot), ".pathfinder-branch-feedback.md");
    const externalFeedbackPath = path.join(resolution.stateRoot, ".pathfinder-branch-feedback.md");

    if (resolution.mode === "external" && await exists(externalFeedbackPath)) {
      return externalFeedbackPath;
    }

    return (await exists(conventionalFeedbackPath)) ? ".pathfinder-branch-feedback.md" : undefined;
  }

  private async getBranchReviewRoot(): Promise<string> {
    const stateRoot = await this.requireStateRoot();
    return path.join(stateRoot, "branch-reviews");
  }

  private async ensureBranchReviewRoot(): Promise<string> {
    const root = await this.getBranchReviewRoot();

    if (!(await exists(root))) {
      await mkdir(root, { recursive: true });
    }

    const sessionsPath = path.join(root, "review-sessions.json");
    if (!(await exists(sessionsPath))) {
      await writeJson(sessionsPath, { sessions: [] } satisfies BranchReviewSessionsFile);
    }

    const commentsPath = path.join(root, "comments.json");
    if (!(await exists(commentsPath))) {
      await writeJson(commentsPath, { comments: [] } satisfies CommentsFile);
    }

    const prPath = path.join(root, "pr.md");
    if (!(await exists(prPath))) {
      await writeFile(prPath, "", "utf8");
    }

    return root;
  }

  private async requireGitRootForAgentCommands(): Promise<string> {
    const gitRoot = await findGitRoot(this.cwd);
    if (!gitRoot) {
      throw new PathfinderError("Agent command management must be run inside a Git repository.");
    }

    return gitRoot;
  }

  private async planAgentCommandFile(
    gitRoot: string,
    file: AgentCommandToolDefinition["files"][number]
  ): Promise<AgentCommandFileResult> {
    const filePath = path.join(gitRoot, ...file.relativePath.split("/"));

    if (!(await exists(filePath))) {
      return {
        tool: file.tool,
        commandName: file.commandName,
        path: filePath,
        relativePath: file.relativePath,
        installed: false,
        managed: false,
        changed: true,
        skipped: false
      };
    }

    const existing = await readFile(filePath, "utf8");
    const hasStart = existing.includes(AGENT_COMMAND_MANAGED_START);
    const hasEnd = existing.includes(AGENT_COMMAND_MANAGED_END);

    if (hasStart && hasEnd) {
      return {
        tool: file.tool,
        commandName: file.commandName,
        path: filePath,
        relativePath: file.relativePath,
        installed: true,
        managed: true,
        changed: existing !== file.markdown,
        skipped: false
      };
    }

    if (hasStart || hasEnd) {
      throw new PathfinderError(`Command file '${file.relativePath}' contains incomplete Pathfinder markers.`);
    }

    return {
      tool: file.tool,
      commandName: file.commandName,
      path: filePath,
      relativePath: file.relativePath,
      installed: true,
      managed: false,
      changed: false,
      skipped: true,
      reason: "Existing file is not Pathfinder-managed."
    };
  }

  private async planUserAgentInstallFile(
    file: AgentUserInstallToolDefinition["files"][number]
  ): Promise<AgentUserInstallFileResult & { markdown: string }> {
    const filePath = path.join(this.getUserAgentInstallRoot(file), ...file.relativePath.split("/"));
    const existing = (await exists(filePath)) ? await readFile(filePath, "utf8") : "";
    const markdown = applyManagedBlock(
      existing,
      file.markdown,
      AGENT_USER_INSTALL_MANAGED_START,
      AGENT_USER_INSTALL_MANAGED_END,
      `${file.relativePath} contains incomplete Pathfinder user agent markers.`,
      `${file.relativePath} contains malformed Pathfinder user agent markers.`
    );

    if (!existing) {
      return {
        tool: file.tool,
        path: filePath,
        relativePath: file.relativePath,
        installed: false,
        managed: false,
        changed: true,
        skipped: false,
        markdown
      };
    }

    const hasStart = existing.includes(AGENT_USER_INSTALL_MANAGED_START);
    const hasEnd = existing.includes(AGENT_USER_INSTALL_MANAGED_END);

    return {
      tool: file.tool,
      path: filePath,
      relativePath: file.relativePath,
      installed: true,
      managed: hasStart && hasEnd,
      changed: markdown !== existing,
      skipped: false,
      markdown
    };
  }

  private getUserHome(): string {
    return path.resolve(this.options.userHome ?? process.env.PATHFINDER_USER_HOME ?? os.homedir());
  }

  private getUserAgentInstallRoot(file: AgentUserInstallToolDefinition["files"][number]): string {
    if (file.installRoot === "codex-home") {
      return this.getCodexHome();
    }

    return this.getUserHome();
  }

  private getCodexHome(): string {
    if (this.options.userHome || process.env.PATHFINDER_USER_HOME) {
      return path.join(this.getUserHome(), ".codex");
    }

    return path.resolve(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"));
  }

  private async validateBranchReviewCommentTarget(
    target: ReviewCommentTarget | undefined,
    structuredDiff: StructuredDiff | undefined
  ): Promise<ReviewCommentTarget> {
    if (!target || target.type === "workstream") {
      return { type: "workstream" };
    }

    if (target.type === "slice") {
      throw new PathfinderError("Branch review comments cannot target a slice.");
    }

    const session = await this.getBranchReviewSession(target.sessionId);
    if (!session.changedFiles.some((file) => changedFileMatches(file.path, file.previousPath, target.filePath))) {
      throw new PathfinderError(
        `File '${target.filePath}' was not found in branch review session '${target.sessionId}'.`
      );
    }

    if (structuredDiff && !structuredDiffHasFile(structuredDiff, target.filePath)) {
      throw new PathfinderError(
        `File '${target.filePath}' was not found in the parsed diff for branch review session '${target.sessionId}'.`
      );
    }

    if (target.type === "file") {
      return target;
    }

    if (!Number.isInteger(target.lineNumber) || target.lineNumber < 1) {
      throw new PathfinderError("Comment line number must be a positive integer.");
    }

    if (!isReviewCommentSide(target.side)) {
      throw new PathfinderError("Invalid comment side. Expected old or new.");
    }

    if (structuredDiff && !structuredDiffHasLine(structuredDiff, target.filePath, target.lineNumber, target.side)) {
      throw new PathfinderError(
        `Line ${target.lineNumber} (${target.side}) was not found for '${target.filePath}' in branch review session '${target.sessionId}'.`
      );
    }

    return target;
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

  private async readBranchReviewSessions(branchReviewRoot: string): Promise<BranchReviewSessionsFile> {
    const filePath = path.join(branchReviewRoot, "review-sessions.json");
    if (!(await exists(filePath))) {
      return { sessions: [] };
    }

    return readJson<BranchReviewSessionsFile>(filePath);
  }

  private async readBranchReviewComments(branchReviewRoot: string): Promise<CommentsFile> {
    const filePath = path.join(branchReviewRoot, "comments.json");
    if (!(await exists(filePath))) {
      return { comments: [] };
    }

    return readJson<CommentsFile>(filePath);
  }

  private async readEvidence(workstreamRoot: string): Promise<EvidenceFile> {
    const filePath = path.join(workstreamRoot, "evidence.json");
    if (!(await exists(filePath))) {
      return { evidence: [] };
    }

    return readJson<EvidenceFile>(filePath);
  }

  private async resolveAgentWorkstream(
    project: Project,
    workstreams: Workstream[]
  ): Promise<Workstream | undefined> {
    if (project.activeWorkstreamId) {
      const active = workstreams.find((workstream) => workstream.id === project.activeWorkstreamId);
      if (!active) {
        throw new PathfinderError(`Active workstream '${project.activeWorkstreamId}' was not found.`);
      }

      return active;
    }

    if (workstreams.length === 1) {
      return workstreams[0];
    }

    return undefined;
  }

  private async tryGetRepositorySummary(
    provider: RepositorySummaryProvider,
    baseRef: string
  ): Promise<{ repositorySummary: RepositorySummary } | { repositorySummaryError: string }> {
    try {
      return {
        repositorySummary: await provider(baseRef)
      };
    } catch (error) {
      return {
        repositorySummaryError: errorMessage(error)
      };
    }
  }

  private async tryGetSuggestedBaseRef(provider: SuggestedBaseRefProvider): Promise<string | undefined> {
    try {
      return await provider();
    } catch {
      return undefined;
    }
  }

  private async tryGetUncommittedChanges(provider: UncommittedChangesProvider): Promise<boolean | undefined> {
    try {
      return await provider();
    } catch {
      return undefined;
    }
  }

  private async checkPathfinderProject(gitRoot: string): Promise<AgentDoctorCheck> {
    try {
      const resolution = await resolveExistingStateRoot(this.cwd, this.options);
      return {
        id: "pathfinder-state",
        status: "pass",
        message: resolution.mode === "external"
          ? `External Pathfinder state exists at ${resolution.stateRoot}.`
          : ".pathfinder/project.json exists."
      };
    } catch {
      // Fall through to a missing-state check.
    }

    return {
      id: "pathfinder-state",
      status: "missing",
      message: "No repo-local or external Pathfinder state was found for this repository.",
      fixCommand: "pathfinder init"
    };
  }

  private async getPersonalAgentDoctorChecks(gitRoot: string): Promise<AgentDoctorCheck[]> {
    const externalResolution = await resolveStateRootForInit(this.cwd, "external", this.options);
    const externalProjectPath = path.join(externalResolution.stateRoot, "project.json");
    const hasExternalProject = await exists(externalProjectPath);
    const hasRepoProject = await exists(path.join(gitRoot, ".pathfinder", "project.json"));

    return [
      {
        id: "cli-command",
        status: "pass",
        message: "Pathfinder CLI command is running."
      },
      checkPersonalStateMode(hasExternalProject, hasRepoProject),
      {
        id: "external-project-state",
        status: hasExternalProject ? "pass" : "missing",
        message: hasExternalProject
          ? `External Pathfinder project state exists at ${externalResolution.stateRoot}.`
          : `External Pathfinder project state was not found at ${externalResolution.stateRoot}.`,
        ...(hasExternalProject ? {} : { fixCommand: "pathfinder init --personal" })
      },
      await this.checkUserAgentInstructions("claude"),
      await this.checkUserAgentInstructions("opencode"),
      await this.checkRepoFootprint(gitRoot)
    ];
  }

  private async checkUserAgentInstructions(tool: AgentUserInstallTool): Promise<AgentDoctorCheck> {
    const definition = getAgentUserInstallToolDefinitions(tool)[0];
    const id = `user-${tool}-instructions`;
    const fixCommand = `pathfinder agent install --user ${tool}`;

    if (definition.files.length === 0) {
      return {
        id,
        status: "pass",
        message: `${definition.displayName} user-level integration is manual for this Pathfinder version.`
      };
    }

    const files = await Promise.all(definition.files.map((file) => this.planUserAgentInstallFile(file)));
    const missing = files.filter((file) => !file.installed);
    const userOwned = files.filter((file) => file.installed && !file.managed);
    const outdated = files.filter((file) => file.installed && file.managed && file.changed);

    if (missing.length > 0) {
      return {
        id,
        status: "missing",
        message: `${definition.displayName} user-level Pathfinder instructions are missing: ${missing.map((file) => file.path).join(", ")}.`,
        fixCommand
      };
    }

    if (userOwned.length > 0) {
      return {
        id,
        status: "warning",
        message: `${definition.displayName} user-level instruction paths exist but are not Pathfinder-managed: ${userOwned.map((file) => file.path).join(", ")}.`,
        fixCommand
      };
    }

    if (outdated.length > 0) {
      return {
        id,
        status: "warning",
        message: `${definition.displayName} user-level Pathfinder instructions are installed but need updating: ${outdated.map((file) => file.path).join(", ")}.`,
        fixCommand
      };
    }

    return {
      id,
      status: "pass",
      message: `${definition.displayName} user-level Pathfinder instructions are installed.`
    };
  }

  private async checkRepoFootprint(gitRoot: string): Promise<AgentDoctorCheck> {
    const footprints = [
      ...(await this.findRepoStateFootprint(gitRoot)),
      ...(await this.findRepoAgentInstructionFootprint(gitRoot)),
      ...(await this.findRepoCommandFootprint(gitRoot))
    ];

    if (footprints.length === 0) {
      return {
        id: "repo-footprint",
        status: "pass",
        message: "No Pathfinder repo-local footprint was found."
      };
    }

    return {
      id: "repo-footprint",
      status: "error",
      message: `Pathfinder repo-local footprint was found: ${footprints.join(", ")}.`
    };
  }

  private async findRepoStateFootprint(gitRoot: string): Promise<string[]> {
    const statePath = path.join(gitRoot, ".pathfinder");
    if (!(await exists(statePath))) {
      return [];
    }

    return [".pathfinder/"];
  }

  private async findRepoAgentInstructionFootprint(gitRoot: string): Promise<string[]> {
    const agentsPath = path.join(gitRoot, "AGENTS.md");
    if (!(await exists(agentsPath))) {
      return [];
    }

    const markdown = await readFile(agentsPath, "utf8");
    const markers = [
      AGENT_BOOTSTRAP_START,
      AGENT_BOOTSTRAP_END,
      AGENT_USER_INSTALL_MANAGED_START,
      AGENT_USER_INSTALL_MANAGED_END
    ];

    return markers.some((marker) => markdown.includes(marker)) ? ["AGENTS.md managed Pathfinder block"] : [];
  }

  private async findRepoCommandFootprint(gitRoot: string): Promise<string[]> {
    const footprints: string[] = [];
    const commandDirectories = [".claude/commands", ".opencode/commands"];

    for (const commandDirectory of commandDirectories) {
      const absoluteDirectory = path.join(gitRoot, ...commandDirectory.split("/"));
      if (!(await exists(absoluteDirectory))) {
        continue;
      }

      const entries = await readdir(absoluteDirectory, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.startsWith("pathfinder-")) {
          continue;
        }

        const relativePath = `${commandDirectory}/${entry.name}`;
        const filePath = path.join(absoluteDirectory, entry.name);
        if (!(await exists(filePath))) {
          continue;
        }

        const markdown = await readFile(filePath, "utf8");
        if (markdown.includes(AGENT_COMMAND_MANAGED_START) || markdown.includes(AGENT_COMMAND_MANAGED_END)) {
          footprints.push(relativePath);
        }
      }
    }

    return footprints;
  }

  private async checkAgentBootstrap(gitRoot: string): Promise<AgentDoctorCheck> {
    const agentsPath = path.join(gitRoot, "AGENTS.md");

    if (!(await exists(agentsPath))) {
      return {
        id: "agents-md",
        status: "missing",
        message: "AGENTS.md was not found.",
        fixCommand: "pathfinder agent bootstrap"
      };
    }

    const markdown = await readFile(agentsPath, "utf8");
    const hasStart = markdown.includes(AGENT_BOOTSTRAP_START);
    const hasEnd = markdown.includes(AGENT_BOOTSTRAP_END);

    if (hasStart && hasEnd) {
      return {
        id: "agents-md",
        status: "pass",
        message: "AGENTS.md contains the Pathfinder managed block."
      };
    }

    if (hasStart || hasEnd) {
      return {
        id: "agents-md",
        status: "error",
        message: "AGENTS.md contains incomplete Pathfinder managed block markers.",
        fixCommand: "pathfinder agent bootstrap"
      };
    }

    return {
      id: "agents-md",
      status: "missing",
      message: "AGENTS.md does not contain the Pathfinder managed block.",
      fixCommand: "pathfinder agent bootstrap"
    };
  }

  private async checkAgentNext(
    provider?: RepositorySummaryProvider,
    uncommittedChangesProvider?: UncommittedChangesProvider
  ): Promise<{
    check: AgentDoctorCheck;
    phase: AgentNextRecommendation["phase"];
  }> {
    try {
      const recommendation = await this.getAgentNext(provider, undefined, uncommittedChangesProvider);
      return {
        check: {
          id: "agent-next",
          status: "pass",
          message: `pathfinder agent next --json returned phase '${recommendation.phase}'.`
        },
        phase: recommendation.phase
      };
    } catch (error) {
      return {
        check: {
          id: "agent-next",
          status: "error",
          message: `pathfinder agent next --json failed: ${errorMessage(error)}`,
          fixCommand: "pathfinder agent next --json"
        },
        phase: "blocked"
      };
    }
  }
}

function checkAgentCommandTool(tool: AgentCommandsListResult["tools"][number]): AgentDoctorCheck {
  const id = `${tool.tool}-commands`;
  const missing = tool.files.filter((file) => !file.installed);
  const userOwned = tool.files.filter((file) => file.installed && !file.managed);
  const outdated = tool.files.filter((file) => file.installed && file.managed && file.changed);
  const fixCommand = `pathfinder agent commands install --tool ${tool.tool}`;

  if (missing.length > 0) {
    return {
      id,
      status: "missing",
      message: `${tool.displayName} Pathfinder command wrappers are missing: ${missing.map((file) => file.relativePath).join(", ")}.`,
      fixCommand
    };
  }

  if (userOwned.length > 0) {
    return {
      id,
      status: "warning",
      message: `${tool.displayName} command wrapper paths exist but are not Pathfinder-managed: ${userOwned.map((file) => file.relativePath).join(", ")}.`,
      fixCommand
    };
  }

  if (outdated.length > 0) {
    return {
      id,
      status: "warning",
      message: `${tool.displayName} Pathfinder command wrappers are installed but need updating: ${outdated.map((file) => file.relativePath).join(", ")}.`,
      fixCommand
    };
  }

  return {
    id,
    status: "pass",
    message: `${tool.displayName} Pathfinder command wrappers are installed.`
  };
}

function checkPersonalStateMode(hasExternalProject: boolean, hasRepoProject: boolean): AgentDoctorCheck {
  if (hasRepoProject) {
    return {
      id: "state-mode",
      status: "error",
      message: "Repo-local Pathfinder state exists; personal doctor expects external state with no repo-local state."
    };
  }

  if (!hasExternalProject) {
    return {
      id: "state-mode",
      status: "missing",
      message: "External Pathfinder state is not initialized for this repository.",
      fixCommand: "pathfinder init --personal"
    };
  }

  return {
    id: "state-mode",
    status: "pass",
    message: "State mode is external for this repository."
  };
}

function changedFileMatches(path: string, previousPath: string | undefined, filePath: string): boolean {
  return path === filePath || previousPath === filePath;
}

function commentTargetsSession(comment: ReviewComment, sessionId: string): boolean {
  return (
    (comment.target?.type === "file" || comment.target?.type === "line") &&
    comment.target.sessionId === sessionId
  );
}

function latestSessionForSlice(sessions: ReviewSession[], sliceId: string | undefined): ReviewSession | undefined {
  if (!sliceId) {
    return undefined;
  }

  return sessions
    .filter((session) => session.sliceId === sliceId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .at(-1);
}

function latestBranchReviewSession(sessions: BranchReviewSession[]): BranchReviewSession | undefined {
  return [...sessions].sort((left, right) => left.createdAt.localeCompare(right.createdAt)).at(-1);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unknown Pathfinder state error.";
}

const AGENT_BOOTSTRAP_START = "<!-- pathfinder-agent:start -->";
const AGENT_BOOTSTRAP_END = "<!-- pathfinder-agent:end -->";

const AGENT_BOOTSTRAP_BLOCK = `${AGENT_BOOTSTRAP_START}
## Pathfinder Agent Workflow

Pathfinder is the source of truth for planning, slice scope, review feedback, and PR output in this repository.

When asked to plan, implement, continue, review, or address feedback here, first run:

\`\`\`bash
pathfinder agent next --json
\`\`\`

Follow the returned \`phase\`, \`commands\`, and \`agentInstruction\`. Use \`pathfinder agent prompt\` when you need tool-neutral markdown instructions for the current phase.

Do not create unmanaged task lists or parallel plans when Pathfinder state exists. Keep implementation scoped to the active Pathfinder slice, and do not resolve Pathfinder comments automatically after making code changes.

MCP is not required for this workflow; use the local Pathfinder CLI commands above.
${AGENT_BOOTSTRAP_END}
`;

function applyAgentBootstrapBlock(existing: string): string {
  return applyManagedBlock(
    existing,
    AGENT_BOOTSTRAP_BLOCK,
    AGENT_BOOTSTRAP_START,
    AGENT_BOOTSTRAP_END,
    "AGENTS.md contains an incomplete Pathfinder agent bootstrap block.",
    "AGENTS.md contains malformed Pathfinder agent bootstrap markers."
  );
}

function applyManagedBlock(
  existing: string,
  block: string,
  startMarker: string,
  endMarker: string,
  incompleteMessage: string,
  malformedMessage: string
): string {
  const startIndex = existing.indexOf(startMarker);
  const endIndex = existing.indexOf(endMarker);

  if ((startIndex === -1) !== (endIndex === -1)) {
    throw new PathfinderError(incompleteMessage);
  }

  if (startIndex !== -1 && endIndex !== -1) {
    if (endIndex < startIndex) {
      throw new PathfinderError(malformedMessage);
    }

    const afterEnd = endIndex + endMarker.length;
    return `${existing.slice(0, startIndex)}${block}${existing.slice(afterEnd).replace(/^\r?\n/, "")}`;
  }

  if (!existing.trim()) {
    return block;
  }

  const trimmedEnd = existing.replace(/\s*$/, "");
  return `${trimmedEnd}\n\n${block}`;
}
