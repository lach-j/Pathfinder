import { PathfinderError } from "./errors.js";

export function toUrlSafeId(input: string): string {
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

export function isUrlSafeId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function nextAvailableId(baseId: string, existingIds: Iterable<string>): string {
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

export function createOpaqueReviewCommentId(existingIds: Iterable<string>): string {
  const existing = new Set(existingIds);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const id = `c-${randomBase36Segment()}`;
    if (!existing.has(id)) {
      return id;
    }
  }

  return nextAvailableId(`c-${Date.now().toString(36)}`, existing);
}

function randomBase36Segment(): string {
  const cryptoSource = (globalThis as {
    crypto?: {
      getRandomValues?: (array: Uint32Array) => Uint32Array;
    };
  }).crypto;
  const values = new Uint32Array(1);

  if (cryptoSource?.getRandomValues) {
    cryptoSource.getRandomValues(values);
  } else {
    values[0] = Math.floor(Math.random() * 0xffffffff);
  }

  return values[0].toString(36).padStart(8, "0").slice(0, 8);
}
