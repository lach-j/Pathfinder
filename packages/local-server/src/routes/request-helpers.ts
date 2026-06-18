import { IncomingMessage } from "node:http";

import {
  PathfinderError,
  ReviewCommentTarget,
  isReviewCommentSide
} from "@pathfinder/core";

import type { CommentRequestBody } from "../server-types.js";

const maxBodyBytes = 1024 * 1024;

export async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let length = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.byteLength;
    if (length > maxBodyBytes) {
      throw new PathfinderError("Request body is too large.");
    }
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    throw new PathfinderError("Request body must be JSON.");
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new PathfinderError("Request body must be valid JSON.");
  }
}

export function commentTargetFromBody(body: CommentRequestBody): ReviewCommentTarget {
  if (body.target !== undefined) {
    return validateTarget(body.target);
  }

  if (body.sessionId === undefined && body.filePath === undefined && body.lineNumber === undefined) {
    return { type: "workstream" };
  }

  const sessionId = requireString(body.sessionId, "Session id");
  const filePath = requireString(body.filePath, "File path");

  if (body.lineNumber === undefined) {
    return {
      type: "file",
      sessionId,
      filePath
    };
  }

  const lineNumber = requirePositiveInteger(body.lineNumber, "Line number");
  const side = requireString(body.side, "Comment side");
  if (!isReviewCommentSide(side)) {
    throw new PathfinderError("Invalid comment side. Expected old or new.");
  }

  return {
    type: "line",
    sessionId,
    filePath,
    lineNumber,
    side
  };
}

export function validateTarget(value: unknown): ReviewCommentTarget {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    throw new PathfinderError("Comment target must include a target type.");
  }

  const target = value as Record<string, unknown>;
  if (target.type === "workstream") {
    return { type: "workstream" };
  }

  if (target.type === "slice") {
    return {
      type: "slice",
      sliceId: requireString(target.sliceId, "Slice id")
    };
  }

  if (target.type === "file") {
    return {
      type: "file",
      sessionId: requireString(target.sessionId, "Session id"),
      filePath: requireString(target.filePath, "File path")
    };
  }

  if (target.type === "line") {
    const side = requireString(target.side, "Comment side");
    if (!isReviewCommentSide(side)) {
      throw new PathfinderError("Invalid comment side. Expected old or new.");
    }

    return {
      type: "line",
      sessionId: requireString(target.sessionId, "Session id"),
      filePath: requireString(target.filePath, "File path"),
      lineNumber: requirePositiveInteger(target.lineNumber, "Line number"),
      side
    };
  }

  throw new PathfinderError("Invalid comment target type.");
}

export function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new PathfinderError(`${name} is required.`);
  }

  return value;
}

export function requirePositiveInteger(value: unknown, name: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new PathfinderError(`${name} must be a positive integer.`);
  }

  return number;
}

export function optionalQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return optionalQueryValue(value[0]);
  }

  return typeof value === "string" && value !== "" ? value : undefined;
}
