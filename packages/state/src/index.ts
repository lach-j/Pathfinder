import { constants } from "node:fs";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  PathfinderError,
  Project,
  Review,
  ReviewComment,
  Slice,
  Workstream,
  assertNonEmptyText,
  createTimestamp,
  nextAvailableId,
  toUrlSafeId
} from "@pathfinder/core";

export interface ActiveSlice {
  workstream: Workstream;
  slice: Slice;
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
    await writeFile(path.join(workstreamRoot, "plan.md"), "", "utf8");
    await writeJson(path.join(workstreamRoot, "slices.json"), { slices: [] } satisfies SlicesFile);
    await writeJson(path.join(workstreamRoot, "comments.json"), { comments: [] } satisfies CommentsFile);
    await writeJson(path.join(workstreamRoot, "reviews.json"), { reviews: [] } satisfies ReviewsFile);
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

  async setPlanFromFile(workstreamId: string, sourceFile: string): Promise<void> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const sourcePath = path.resolve(this.cwd, sourceFile);

    if (!(await exists(sourcePath))) {
      throw new PathfinderError(`Plan file not found: ${sourceFile}`);
    }

    const content = await readFile(sourcePath, "utf8");
    await writeFile(path.join(root, "plan.md"), content, "utf8");
  }

  async getPlan(workstreamId: string): Promise<string> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    return readFile(path.join(root, "plan.md"), "utf8");
  }

  async addSlice(workstreamId: string, title: string, description: string): Promise<Slice> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const cleanTitle = assertNonEmptyText(title, "Slice title");
    const cleanDescription = assertNonEmptyText(description, "Slice description");
    const slicesFile = await this.readSlices(root);
    const id = nextAvailableId(
      toUrlSafeId(cleanTitle),
      slicesFile.slices.map((slice) => slice.id)
    );
    const now = createTimestamp();
    const slice: Slice = {
      id,
      title: cleanTitle,
      description: cleanDescription,
      status: "proposed",
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

  async listReviews(workstreamId: string): Promise<Review[]> {
    const root = await this.requireWorkstreamRoot(workstreamId);
    const reviewsFile = await this.readReviews(root);
    return reviewsFile.reviews;
  }

  async getReview(workstreamId: string, reviewId: string): Promise<Review> {
    const reviews = await this.listReviews(workstreamId);
    const review = reviews.find((candidate) => candidate.id === reviewId);

    if (!review) {
      throw new PathfinderError(`Review '${reviewId}' was not found in workstream '${workstreamId}'.`);
    }

    return review;
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

  private async readComments(workstreamRoot: string): Promise<CommentsFile> {
    return readJson<CommentsFile>(path.join(workstreamRoot, "comments.json"));
  }

  private async readReviews(workstreamRoot: string): Promise<ReviewsFile> {
    return readJson<ReviewsFile>(path.join(workstreamRoot, "reviews.json"));
  }
}

export async function findGitRoot(startDirectory: string): Promise<string | undefined> {
  let current = path.resolve(startDirectory);

  while (true) {
    if (await isDirectory(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(filePath: string): Promise<boolean> {
  try {
    const result = await stat(filePath);
    return result.isDirectory();
  } catch {
    return false;
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new PathfinderError(`Could not parse JSON file: ${filePath}`);
    }
    throw error;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
