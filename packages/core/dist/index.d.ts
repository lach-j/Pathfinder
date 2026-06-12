export type SliceStatus = "proposed" | "ready" | "in_progress" | "review" | "complete";
export declare const sliceStatuses: readonly SliceStatus[];
export interface Project {
    schemaVersion: 1;
    name: string;
    createdAt: string;
    activeWorkstreamId?: string;
}
export interface Workstream {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    activeSliceId?: string;
}
export interface Plan {
    workstreamId: string;
    markdown: string;
}
export interface Slice {
    id: string;
    title: string;
    description: string;
    status: SliceStatus;
    createdAt: string;
    updatedAt: string;
}
export interface ReviewComment {
    id: string;
    sliceId?: string;
    body: string;
    resolved: boolean;
    createdAt: string;
    resolvedAt?: string;
}
export interface Review {
    id: string;
    sliceId: string;
    status: "open" | "complete";
    summary: string;
    comments: ReviewComment[];
    evidence: Evidence[];
    createdAt: string;
    updatedAt: string;
}
export interface Evidence {
    id: string;
    kind: "test" | "screenshot" | "log" | "manual" | "benchmark" | "other";
    description: string;
    path?: string;
    createdAt: string;
}
export declare class PathfinderError extends Error {
    constructor(message: string);
}
export declare function isSliceStatus(value: string): value is SliceStatus;
export declare function assertNonEmptyText(value: string, label: string): string;
export declare function toUrlSafeId(input: string): string;
export declare function isUrlSafeId(value: string): boolean;
export declare function nextAvailableId(baseId: string, existingIds: Iterable<string>): string;
export declare function createTimestamp(date?: Date): string;
//# sourceMappingURL=index.d.ts.map