import { EvidenceKind, evidenceKinds } from "./domain.js";

export function isEvidenceKind(value: string): value is EvidenceKind {
  return evidenceKinds.includes(value as EvidenceKind);
}
