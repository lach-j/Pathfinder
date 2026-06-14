import { PathfinderError } from "./errors.js";
import { StateMode, stateModes } from "./domain.js";

export function assertNonEmptyText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new PathfinderError(`${label} is required.`);
  }
  return trimmed;
}

export function isStateMode(value: string): value is StateMode {
  return stateModes.includes(value as StateMode);
}
