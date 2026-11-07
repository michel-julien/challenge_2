import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";

import {
  DEFAULT_PROJECTS,
  scanWorkspace,
} from "../security-checker/check-security.mjs";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(testsDirectory, "..");

let report;

before(async () => {
  report = await scanWorkspace(rootDirectory);
});

test("scans Node.js version and lifecycle for every application", () => {
  assert.deepEqual(
    report.projects.map((project) => project.project),
    DEFAULT_PROJECTS,
  );

  for (const project of report.projects) {
    assert.match(project.node.configured, /^node:\d+/);
    assert.ok(Number.isInteger(project.node.major));
    assert.notEqual(project.node.supportStatus, "unknown");
    assert.ok(["supported", "eol"].includes(project.node.supportStatus));
  }
});

test("runs npm audit for every application", () => {
  for (const project of report.projects) {
    assert.equal(project.audit.status, "completed");
    assert.equal(project.audit.command, "npm audit");
    assert.ok(Number.isInteger(project.audit.total));
  }
});

test("reports configuration reviews for the vulnerable API", () => {
  const project = report.projects.find((entry) => entry.project === "unsecure");
  const findingIds = new Set(
    project.configurationReview.findings.map((finding) => finding.id),
  );

  assert.equal(findingIds.has("hard-coded-jwt-secret"), true);
  assert.equal(findingIds.has("clear-text-password"), true);
  assert.equal(findingIds.has("jwt-without-expiration"), true);
  assert.equal(findingIds.has("unvalidated-upload"), true);
});

test("checks secure API and frontend configuration surfaces", () => {
  const secure = report.projects.find((entry) => entry.project === "secure");
  const frontend = report.projects.find((entry) => entry.project === "frontend");

  assert.equal(
    secure.configurationReview.findings.some(
      (finding) => finding.id === "default-jwt-secret",
    ),
    true,
  );
  assert.equal(
    frontend.configurationReview.findings.some(
      (finding) => finding.id === "frontend-http-api",
    ),
    true,
  );
});
