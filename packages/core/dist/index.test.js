import assert from "node:assert/strict";
import test from "node:test";
import { PathfinderError, assertNonEmptyText, isSliceStatus, isUrlSafeId, nextAvailableId, toUrlSafeId } from "./index.js";
test("creates URL-safe ids from titles", () => {
    assert.equal(toUrlSafeId(" Add Billing: Phase 1! "), "add-billing-phase-1");
    assert.equal(isUrlSafeId("add-billing-phase-1"), true);
    assert.equal(isUrlSafeId("Add Billing"), false);
});
test("allocates a stable numeric suffix when an id already exists", () => {
    assert.equal(nextAvailableId("slice", ["slice", "slice-2"]), "slice-3");
    assert.equal(nextAvailableId("slice", ["other"]), "slice");
});
test("validates required text and slice statuses", () => {
    assert.equal(assertNonEmptyText("  usable  ", "Title"), "usable");
    assert.equal(isSliceStatus("in_progress"), true);
    assert.equal(isSliceStatus("blocked"), false);
    assert.throws(() => assertNonEmptyText(" ", "Title"), PathfinderError);
});
