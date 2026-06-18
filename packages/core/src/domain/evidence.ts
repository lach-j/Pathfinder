export type EvidenceKind = "test" | "screenshot" | "log" | "manual" | "benchmark" | "other";

export const evidenceKinds: readonly EvidenceKind[] = [
  "test",
  "screenshot",
  "log",
  "manual",
  "benchmark",
  "other"
];

export interface Evidence {
  id: string;
  sliceId: string;
  kind: EvidenceKind;
  description: string;
  path?: string;
  createdAt: string;
}
