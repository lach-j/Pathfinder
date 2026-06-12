export const sliceStatuses = [
    "proposed",
    "ready",
    "in_progress",
    "review",
    "complete"
];
export class PathfinderError extends Error {
    constructor(message) {
        super(message);
        this.name = "PathfinderError";
    }
}
export function isSliceStatus(value) {
    return sliceStatuses.includes(value);
}
export function assertNonEmptyText(value, label) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new PathfinderError(`${label} is required.`);
    }
    return trimmed;
}
export function toUrlSafeId(input) {
    const slug = input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-");
    if (!slug) {
        throw new PathfinderError("Could not create a URL-safe id from the provided text.");
    }
    return slug;
}
export function isUrlSafeId(value) {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
export function nextAvailableId(baseId, existingIds) {
    const existing = new Set(existingIds);
    if (!existing.has(baseId)) {
        return baseId;
    }
    let suffix = 2;
    while (existing.has(`${baseId}-${suffix}`)) {
        suffix += 1;
    }
    return `${baseId}-${suffix}`;
}
export function createTimestamp(date = new Date()) {
    return date.toISOString();
}
