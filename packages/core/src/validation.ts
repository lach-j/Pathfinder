import { PathfinderError } from "./errors.js";

export function assertNonEmptyText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new PathfinderError(`${label} is required.`);
  }
  return trimmed;
}
