import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeCustomerZeroResultFilters,
  filterCustomerZeroResults,
} from "../src/scanner/customer_zero_result_filters.mjs";

test("defaults to showing all Customer Zero result states", () => {
  const preferences = normalizeCustomerZeroResultFilters();
  assert.equal(preferences.showAll, true);
  assert.equal(preferences.states.length, 8);
});

test("accepts multiple unique states and ignores unknown values", () => {
  const preferences = normalizeCustomerZeroResultFilters({
    states: ["enter", "WAIT", "enter", "mystery"],
  });
  assert.deepEqual(preferences.states, ["ENTER", "WAIT"]);
  assert.equal(preferences.showAll, false);
});

test("filters results by normalized state", () => {
  const results = [
    { symbol: "AAPL", decision: "ENTER", permission: "approved" },
    { symbol: "MSFT", primaryCommand: "WAIT_FOR_CONFIRMATION" },
    { symbol: "NVDA", stale: true },
  ];

  const filtered = filterCustomerZeroResults(results, {
    states: ["WAIT", "STALE_DATA"],
  });

  assert.deepEqual(filtered.map((item) => item.symbol), ["MSFT", "NVDA"]);
});

test("empty saved selection falls back to show all", () => {
  const preferences = normalizeCustomerZeroResultFilters({ states: [] });
  assert.equal(preferences.showAll, true);
});
