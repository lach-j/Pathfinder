import { Slice, SliceStatus, sliceStatuses } from "./domain.js";

export function isSliceStatus(value: string): value is SliceStatus {
  return sliceStatuses.includes(value as SliceStatus);
}

export function isSliceActionable(slice: Slice, slices: Slice[]): boolean {
  if (slice.status !== "proposed" && slice.status !== "ready") {
    return false;
  }

  const byId = new Map(slices.map((candidate) => [candidate.id, candidate]));
  return (slice.dependsOnSliceIds ?? []).every((dependencyId) => byId.get(dependencyId)?.status === "complete");
}

export function findNextActionableSlice(slices: Slice[]): Slice | undefined {
  return [...slices]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .find((slice) => isSliceActionable(slice, slices));
}
