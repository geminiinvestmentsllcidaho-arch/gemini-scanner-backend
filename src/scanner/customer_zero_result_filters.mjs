export const VERSION = "customer_zero_result_filters_v1";

import {
  CUSTOMER_ZERO_RESULT_STATES,
  normalizeCustomerZeroResultState,
} from "./customer_zero_result_state.mjs";

const STATE_SET = new Set(CUSTOMER_ZERO_RESULT_STATES);

function normalizeState(value) {
  const state = String(value ?? "")
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");
  return STATE_SET.has(state) ? state : null;
}

export function normalizeCustomerZeroResultFilters(input = {}) {
  const raw = Array.isArray(input)
    ? input
    : Array.isArray(input?.states)
      ? input.states
      : [];

  const states = [];
  for (const value of raw) {
    const state = normalizeState(value);
    if (state && !states.includes(state)) states.push(state);
  }

  const selected = states.length > 0
    ? states
    : [...CUSTOMER_ZERO_RESULT_STATES];

  return Object.freeze({
    version: VERSION,
    states: Object.freeze(selected),
    showAll: selected.length === CUSTOMER_ZERO_RESULT_STATES.length,
  });
}

export function filterCustomerZeroResults(results = [], filters = {}) {
  const preferences = normalizeCustomerZeroResultFilters(filters);
  const allowed = new Set(preferences.states);

  return (Array.isArray(results) ? results : []).filter((result) => {
    const normalized = normalizeCustomerZeroResultState(result);
    return allowed.has(normalized.state);
  });
}

export default {
  VERSION,
  normalizeCustomerZeroResultFilters,
  filterCustomerZeroResults,
};
