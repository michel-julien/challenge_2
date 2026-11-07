import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

export const DEFAULT_PROJECTS = Object.freeze([
  "unsecure",
  "secure",
  "frontend",
]);

const NODE_SCHEDULE_URL =
  "https://raw.githubusercontent.com/nodejs/Release/main/schedule.json";
const NODE_RELEASES_URL = "https://nodejs.org/dist/index.json";
const AUDIT_MAX_BUFFER = 16 * 1024 * 1024;

const severityOrder = ["critical", "high", "moderate", "low", "info"];

async function readOptional(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function relativePath(rootDirectory, filePath) {
  return path.relative(rootDirectory, filePath) || ".";
}

function addFinding(findings, severity, file, message, id) {
  findings.push({ id, severity, file, message });
}

function parseNodeImage(dockerfile) {
  if (!dockerfile) return null;

  const match = dockerfile.match(
    /^\s*FROM\s+(?:--platform=\S+\s+)?node:([^\s]+)\s*$/im,
  );
  if (!match) return null;

  const tag = match[1];
  const versionMatch = tag.match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/);

  return {
    image: `node:${tag}`,
    tag,
    major: versionMatch ? Number(versionMatch[1]) : null,
    exactVersion: versionMatch?.[2] && versionMatch?.[3]
      ? `${versionMatch[1]}.${versionMatch[2]}.${versionMatch[3]}`
      : null,
    digestPinned: /@sha256:[a-f0-9]{64}$/i.test(tag),
  };
}

function parseDate(value) {
  if (!value || value === false) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getNodeLifecycle(major, schedule, now = new Date()) {
  const release = schedule?.[`v${major}`];
  if (!release) {
    return {
      lifecycle: "Unknown",
      supportStatus: "unknown",
      supported: null,
      lts: false,
      endOfLife: null,
    };
  }

  const ltsDate = parseDate(release.lts);
  const maintenanceDate = parseDate(release.maintenance);
  const endDate = parseDate(release.end);

  if (endDate && now > endDate) {
    return {
      lifecycle: "End of life",
      supportStatus: "eol",
      supported: false,
      lts: Boolean(ltsDate),
      endOfLife: release.end,
    };
  }

  if (maintenanceDate && now >= maintenanceDate) {
    return {
      lifecycle: "Maintenance LTS",
      supportStatus: "supported",
      supported: true,
      lts: true,
      endOfLife: release.end ?? null,
    };
  }

  if (ltsDate && now >= ltsDate) {
    return {
      lifecycle: "Active LTS",
      supportStatus: "supported",
      supported: true,
      lts: true,
      endOfLife: release.end ?? null,
    };
  }

  return {
    lifecycle: "Current",
    supportStatus: "supported",
    supported: true,
    lts: false,
    endOfLife: release.end ?? null,
  };
}

function latestReleaseForMajor(major, releases) {
  if (!Array.isArray(releases)) return null;

  const matching = releases
    .filter((release) => release.version?.match(new RegExp(`^v${major}\\.`)))
    .sort((left, right) => right.version.localeCompare(left.version, undefined, {
      numeric: true,
    }));

  return matching[0]?.version ?? null;
}

export function evaluateNodeVersion(nodeImage, metadata, now = new Date()) {
  if (!nodeImage?.major) {
    return {
      configured: nodeImage?.image ?? null,
      major: null,
      lifecycle: "Unknown",
      supportStatus: "unknown",
      supported: null,
      lts: false,
      latestInMajor: null,
      patchStatus: "unknown",
      endOfLife: null,
    };
  }

  const lifecycle = getNodeLifecycle(nodeImage.major, metadata?.schedule, now);
  const latestInMajor = latestReleaseForMajor(
    nodeImage.major,
    metadata?.releases,
  );

  let patchStatus = "floating-major-tag";
  if (nodeImage.exactVersion && latestInMajor) {
    patchStatus = `v${nodeImage.exactVersion}` === latestInMajor
      ? "current"
      : "older-than-latest-patch";
  } else if (!latestInMajor) {
    patchStatus = "unknown";
  }

  return {
    configured: nodeImage.image,
    tag: nodeImage.tag,
    major: nodeImage.major,
    lifecycle: lifecycle.lifecycle,
    supportStatus: lifecycle.supportStatus,
    supported: lifecycle.supported,
    lts: lifecycle.lts,
    latestInMajor,
    patchStatus,
    endOfLife: lifecycle.endOfLife,
    digestPinned: nodeImage.digestPinned,
  };
}

async function fetchJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

export async function loadNodeMetadata(fetchImpl = fetch) {
  const [scheduleResult, releasesResult] = await Promise.allSettled([
    fetchJson(NODE_SCHEDULE_URL, fetchImpl),
    fetchJson(NODE_RELEASES_URL, fetchImpl),
  ]);

  return {
    schedule: scheduleResult.status === "fulfilled"
      ? scheduleResult.value
      : null,
    releases: releasesResult.status === "fulfilled"
      ? releasesResult.value
      : null,
    errors: [scheduleResult, releasesResult]
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason.message),
  };
}

function parseAuditJson(output) {
  const text = output.trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // npm write warning before the JSON report
  }

  for (let index = text.indexOf("{"); index >= 0; index = text.indexOf(
    "{",
    index + 1,
  )) {
    try {
      return JSON.parse(text.slice(index));
    } catch {
      // continue until a JSON object is found
    }
  }

  return null;
}

function emptySeverityCounts() {
  return {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
  };
}

function countAuditVulnerabilities(report) {
  const counts = emptySeverityCounts();
  const metadataCounts = report?.metadata?.vulnerabilities;

  if (metadataCounts) {
    for (const severity of Object.keys(counts)) {
      counts[severity] = Number(metadataCounts[severity] ?? 0);
    }
    return counts;
  }

  for (const vulnerability of Object.values(report?.vulnerabilities ?? {})) {
    const severity = vulnerability.severity;
    if (severity in counts) counts[severity] += 1;
  }

  return counts;
}

async function runCommand(command, args, options = {}) {
  try {
    const result = await execFileAsync(command, args, {
      ...options,
      maxBuffer: AUDIT_MAX_BUFFER,
    });
    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    return {
      exitCode: typeof error.code === "number" ? error.code : 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? error.message,
    };
  }
}

export async function auditDependencies(projectPath, packageJson) {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "challenge-2-security-audit-"),
  );

  try {
    const auditManifest = {
      name: `${packageJson.name ?? path.basename(projectPath)}-audit`,
      version: packageJson.version ?? "0.0.0",
      private: true,
      dependencies: packageJson.dependencies ?? {},
      devDependencies: packageJson.devDependencies ?? {},
    };

    await writeFile(
      path.join(temporaryDirectory, "package.json"),
      `${JSON.stringify(auditManifest, null, 2)}\n`,
    );

    const install = await runCommand(
      npmCommand,
      [
        "install",
        "--package-lock-only",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--no-progress",
        "--loglevel=error",
      ],
      { cwd: temporaryDirectory },
    );

    if (install.exitCode !== 0) {
      return {
        status: "unavailable",
        command: "npm audit",
        error: (install.stderr || install.stdout).trim().slice(-1000),
        vulnerabilities: emptySeverityCounts(),
        total: 0,
      };
    }

    const audit = await runCommand(
      npmCommand,
      ["audit", "--json", "--audit-level=low", "--loglevel=error"],
      { cwd: temporaryDirectory },
    );
    const report = parseAuditJson(audit.stdout);

    if (!report) {
      return {
        status: "unavailable",
        command: "npm audit",
        error: (audit.stderr || audit.stdout).trim().slice(-1000),
        vulnerabilities: emptySeverityCounts(),
        total: 0,
      };
    }

    const vulnerabilities = countAuditVulnerabilities(report);
    const total = Object.values(vulnerabilities).reduce(
      (sum, count) => sum + count,
      0,
    );

    return {
      status: "completed",
      command: "npm audit",
      exitCode: audit.exitCode,
      clean: total === 0,
      vulnerabilities,
      total,
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function collectProjectFiles(projectPath) {
  const packagePath = path.join(projectPath, "package.json");
  const dockerfilePath = path.join(projectPath, "Dockerfile");
  const packageText = await readFile(packagePath, "utf8");
  const packageJson = JSON.parse(packageText);
  const dockerfile = await readOptional(dockerfilePath);

  return {
    packagePath,
    packageJson,
    dockerfilePath,
    dockerfile,
    nodeImage: parseNodeImage(dockerfile),
  };
}

function findNodeConfigurationIssues(project, files, rootDirectory) {
  const findings = [];
  const dockerfile = files.dockerfile ?? "";
  const dockerfileName = relativePath(rootDirectory, files.dockerfilePath);

  if (!files.nodeImage) {
    addFinding(
      findings,
      "high",
      dockerfileName,
      "The Dockerfile does not expose a recognizable Node.js base image.",
      "node-version-missing",
    );
  } else if (!files.nodeImage.digestPinned) {
    addFinding(
      findings,
      "low",
      dockerfileName,
      `The Node.js image ${files.nodeImage.image} is tag-based and not pinned to a digest, review image reproducibility and patch updates`,
      "node-image-not-digest-pinned",
    );
  }

  if (/NODE_ENV\s*[=:]\s*["']?development\b/i.test(dockerfile)) {
    addFinding(
      findings,
      "medium",
      dockerfileName,
      "The container defaults to development mode",
      "development-mode",
    );
  }

  if (!/^\s*USER\s+\S+/im.test(dockerfile)) {
    addFinding(
      findings,
      "high",
      dockerfileName,
      "The container does not declare a non root runtime user",
      "container-root-user",
    );
  }

  return findings;
}

async function findComposeIssues(project, rootDirectory, findings) {
  const composePath = path.join(rootDirectory, "docker-compose.yaml");
  const compose = await readOptional(composePath);
  if (!compose) return;

  const serviceMatch = compose.match(
    new RegExp(`\\n  ${project}:\\n([\\s\\S]*?)(?=\\n  \\w|$)`),
  );
  const service = serviceMatch?.[1] ?? "";
  const relativeComposePath = relativePath(rootDirectory, composePath);

  if (/NODE_ENV:\s*development\b/i.test(service)) {
    addFinding(
      findings,
      "medium",
      relativeComposePath,
      `The ${project} service runs with NODE_ENV=development, use a vault when deployed publicly`,
      "compose-development-mode",
    );
  }

  if (/APP_HOST:\s*0\.0\.0\.0|HOSTNAME:\s*0\.0\.0\.0/.test(service)) {
    addFinding(
      findings,
      "low",
      relativeComposePath,
      `The ${project} service binds to all container interfaces. Confirm that the published port and network exposure are intentional`,
      "compose-public-bind",
    );
  }

  if (
    project === "secure" &&
    /JWT_SECRET:\s*["']?\$\{[^}]+:-[^}]*\b(?:local|development|change|secret)[^}]*\}/i.test(
      service,
    )
  ) {
    addFinding(
      findings,
      "high",
      relativeComposePath,
      "The secure service has a predictable fallback JWT secret. Require a deployment secret and fail closed when it is missing.",
      "default-jwt-secret",
    );
  }
}

async function findApplicationIssues(project, projectPath, rootDirectory, findings) {
  const relative = (file) => relativePath(rootDirectory, path.join(projectPath, file));

  if (project === "unsecure") {
    const authMiddleware = await readOptional(
      path.join(projectPath, "src", "middleware", "auth.js"),
    );
    const authRoutes = await readOptional(
      path.join(projectPath, "src", "routes", "auth.js"),
    );
    const uploadMiddleware = await readOptional(
      path.join(projectPath, "src", "middleware", "upload.js"),
    );

    if (authMiddleware && /JWT_SECRET\s*=\s*["'](?:secret|password|changeme)/i.test(authMiddleware)) {
      addFinding(
        findings,
        "high",
        relative("src/middleware/auth.js"),
        "A weak JWT secret is hard-coded in source code",
        "hard-coded-jwt-secret",
      );
    }

    if (authRoutes && /password\s*,|password\s*:/i.test(authRoutes)) {
      addFinding(
        findings,
        "critical",
        relative("src/routes/auth.js"),
        "The authentication route stores or compares a password as clear text.",
        "clear-text-password",
      );
    }

    if (authRoutes && /jwt\.sign\s*\(/.test(authRoutes) && !/expiresIn/.test(authRoutes)) {
      addFinding(
        findings,
        "high",
        relative("src/routes/auth.js"),
        "JWTs are created without an explicit expiration time",
        "jwt-without-expiration",
      );
    }

    if (uploadMiddleware && /multer\s*\(\s*\{\s*dest/i.test(uploadMiddleware)) {
      addFinding(
        findings,
        "high",
        relative("src/middleware/upload.js"),
        "File uploads use a raw Multer destination without visible size, type, or content validation",
        "unvalidated-upload",
      );
    }
  }

  if (project === "secure") {
    const envConfig = await readOptional(path.join(projectPath, "src", "config", "env.js"));
    const server = await readOptional(path.join(projectPath, "src", "server.js"));

    if (!envConfig || !/JWT_SECRET/.test(envConfig) || !/length\s*<\s*32/.test(envConfig)) {
      addFinding(
        findings,
        "high",
        relative("src/config/env.js"),
        "JWT_SECRET is not clearly required and length-checked at startup",
        "jwt-secret-not-validated",
      );
    }

    if (!server || !/helmet\s*\(/.test(server)) {
      addFinding(
        findings,
        "medium",
        relative("src/server.js"),
        "Helmet is not visibly enabled on the secure API",
        "missing-security-headers",
      );
    }

    if (!server || !/loginLimiter/.test(server)) {
      addFinding(
        findings,
        "high",
        relative("src/server.js"),
        "The login rate limiter is not visibly mounted on the secure API",
        "missing-login-rate-limit",
      );
    }
  }

  if (project === "frontend") {
    const envExamplePath = path.join(projectPath, ".env.example");
    const envExample = await readOptional(envExamplePath);
    const nextConfigPath = path.join(projectPath, "next.config.ts");
    const nextConfig = await readOptional(nextConfigPath);
    const apiClient = await readOptional(path.join(projectPath, "lib", "api.ts"));

    if (envExample && /NEXT_PUBLIC_[^=]+=http:\/\//i.test(envExample)) {
      addFinding(
        findings,
        "medium",
        relative(".env.example"),
        "The public API URL uses HTTP. Require HTTPS outside local development",
        "frontend-http-api",
      );
    }

    if (nextConfig && !/headers\s*[:(]/.test(nextConfig)) {
      addFinding(
        findings,
        "medium",
        relative("next.config.ts"),
        "Security headers are not explicitly configured in Next.js. Review CSP, frame, referrer, and content-type policies",
        "next-security-headers-review",
      );
    }

    if (apiClient && /(?:localStorage|sessionStorage)\s*\./.test(apiClient)) {
      addFinding(
        findings,
        "high",
        relative("lib/api.ts"),
        "The frontend appears to persist authentication data in browser storage, Review XSS and token exposure risks",
        "browser-token-storage",
      );
    }
  }
}

export async function scanProject(
  project,
  projectPath,
  rootDirectory,
  metadata,
  options = {},
) {
  const files = await collectProjectFiles(projectPath);
  const findings = findNodeConfigurationIssues(project, files, rootDirectory);

  await findComposeIssues(project, rootDirectory, findings);
  await findApplicationIssues(project, projectPath, rootDirectory, findings);

  const node = evaluateNodeVersion(files.nodeImage, metadata);
  if (metadata.errors.length > 0) {
    addFinding(
      findings,
      "medium",
      relativePath(rootDirectory, files.dockerfilePath),
      `Node.js lifecycle metadata could not be fully loaded: ${metadata.errors.join(", ")}`,
      "node-lifecycle-unavailable",
    );
  }

  const audit = options.skipAudit
    ? {
        status: "skipped",
        command: "npm audit",
        vulnerabilities: emptySeverityCounts(),
        total: 0,
      }
    : await auditDependencies(projectPath, files.packageJson);

  if (audit.status !== "completed") {
    addFinding(
      findings,
      "high",
      relativePath(rootDirectory, files.packagePath),
      `npm audit could not be completed: ${audit.error ?? "unknown error"}`,
      "dependency-audit-unavailable",
    );
  }

  return {
    project,
    path: relativePath(rootDirectory, projectPath),
    node,
    audit,
    configurationReview: {
      status: findings.length > 0 ? "review-required" : "no-findings",
      findings,
    },
  };
}

export async function scanWorkspace(rootDirectory, options = {}) {
  const projects = options.projects ?? DEFAULT_PROJECTS;
  const metadata = options.metadata ?? await loadNodeMetadata();
  const reports = [];

  for (const project of projects) {
    const projectPath = path.join(rootDirectory, project);
    reports.push(
      await scanProject(project, projectPath, rootDirectory, metadata, options),
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    checkerNode: process.version,
    projects: reports,
  };
}

function formatAudit(audit) {
  if (audit.status !== "completed") return `${audit.status}`;
  if (audit.clean) return "clean (0 vulnerabilities)";

  const counts = severityOrder
    .filter((severity) => audit.vulnerabilities[severity] > 0)
    .map((severity) => `${severity}=${audit.vulnerabilities[severity]}`)
    .join(", ");
  return `${audit.total} vulnerability finding(s): ${counts}`;
}

export function formatReport(report) {
  const lines = [
    "Security checker",
    `Generated: ${report.generatedAt}`,
    `Checker runtime: ${report.checkerNode}`,
  ];

  for (const project of report.projects) {
    lines.push(`\n[${project.project}]`);
    lines.push(
      `Node.js: ${project.node.configured ?? "not detected"} | ${project.node.lifecycle} | support=${project.node.supportStatus} | patch=${project.node.patchStatus}`,
    );
    if (project.node.latestInMajor) {
      lines.push(`Latest release in major: ${project.node.latestInMajor}`);
    }
    lines.push(`Dependencies: ${formatAudit(project.audit)}`);
    lines.push(
      `Configuration: ${project.configurationReview.status} (${project.configurationReview.findings.length} finding(s))`,
    );

    for (const finding of project.configurationReview.findings) {
      lines.push(
        `  [${finding.severity.toUpperCase()}] ${finding.file} — ${finding.message}`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

function isMainModule() {
  return process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const jsonOutput = process.argv.includes("--json");
  const skipAudit = process.argv.includes("--skip-audit");
  const requestedProjects = process.argv
    .filter((argument) => argument.startsWith("--project="))
    .map((argument) => argument.slice("--project=".length));

  try {
    const report = await scanWorkspace(rootDirectory, {
      skipAudit,
      projects: requestedProjects.length > 0 ? requestedProjects : undefined,
    });
    process.stdout.write(jsonOutput ? `${JSON.stringify(report, null, 2)}\n` : formatReport(report));
  } catch (error) {
    console.error(`Security checker failed: ${error.stack ?? error.message}`);
    process.exitCode = 1;
  }
}
