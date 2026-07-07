import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { buildAppNavigationReadonly } from "../src/scanner/app_navigation_readonly.mjs";

test("first tiny manual paper attempt review packet route is registered and listed", () => {
  const route = "/app/first-tiny-manual-paper-attempt-review-packet";
  const server = fs.readFileSync("src/server.js", "utf8");

  assert.ok(
    server.includes(`app.get("${route}"`) || server.includes(`app.get('${route}'`),
    "server route should be registered"
  );

  const nav = buildAppNavigationReadonly({});
  const entry = nav.entries.find((item) => item.id === "first_tiny_manual_paper_attempt_review_packet");

  assert.ok(entry);
  assert.equal(entry.category, "paper_attempt");
  assert.equal(entry.href, route);
  assert.equal(entry.routeHref, route);
  assert.equal(entry.displayState, "FIRST_TINY_MANUAL_PAPER_ATTEMPT_REVIEW_PACKET_READONLY");
  assert.equal(entry.refreshFriendly, true);
});
