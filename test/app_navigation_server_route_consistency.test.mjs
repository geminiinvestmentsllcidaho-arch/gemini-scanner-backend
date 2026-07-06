import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { buildAppNavigationReadonly } from "../src/scanner/app_navigation_readonly.mjs";

function extractServerAppRoutes(source) {
  const routes = [];
  const routeRe = /app\.get\(\s*("|'|`)([^"'`]+)\1/g;
  for (const match of source.matchAll(routeRe)) {
    if (match[2].startsWith("/app/")) routes.push(match[2]);
  }
  return routes;
}

function normalizeNavRoute(routeHref) {
  return String(routeHref ?? "").split("?")[0];
}

function duplicates(values) {
  return [...new Set(values.filter((value, index, array) => array.indexOf(value) !== index))].sort();
}

test("app navigation app routes are backed by server routes", () => {
  const serverSource = fs.readFileSync("src/server.js", "utf8");
  const serverRoutes = extractServerAppRoutes(serverSource);
  const serverRouteSet = new Set(serverRoutes);

  const nav = buildAppNavigationReadonly({});
  const navRoutes = nav.entries
    .map((entry) => entry.routeHref)
    .filter((routeHref) => typeof routeHref === "string" && routeHref.startsWith("/app/"));

  const missingServerRoutes = navRoutes
    .map(normalizeNavRoute)
    .filter((route) => !serverRouteSet.has(route))
    .sort();

  assert.deepEqual(missingServerRoutes, []);
  assert.deepEqual(duplicates(navRoutes), []);
  assert.deepEqual(duplicates(serverRoutes), []);
});
