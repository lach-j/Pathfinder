import { PathfinderError, Slice, assertNonEmptyText } from "@pathfinder/core";

export function validateDependencies(
  workstreamId: string,
  slices: Slice[],
  sliceId: string,
  dependencySliceIds: string[]
): string[] {
  const seen = new Set<string>();
  const dependencies: string[] = [];

  for (const rawDependencyId of dependencySliceIds) {
    const dependencyId = assertNonEmptyText(rawDependencyId, "Dependency slice id");

    if (dependencyId === sliceId) {
      throw new PathfinderError(`Slice '${sliceId}' cannot depend on itself.`);
    }

    if (!slices.some((slice) => slice.id === dependencyId)) {
      throw new PathfinderError(
        `Dependency slice '${dependencyId}' was not found in workstream '${workstreamId}'.`
      );
    }

    if (seen.has(dependencyId)) {
      throw new PathfinderError(`Slice '${sliceId}' already depends on '${dependencyId}'.`);
    }

    seen.add(dependencyId);
    dependencies.push(dependencyId);
  }

  return dependencies;
}
