import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { once } from "node:events";
import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "secure-test-secret-that-is-at-least-32-characters";
process.env.JWT_EXPIRES_IN = "1h";
process.env.CORS_ORIGIN = "http://localhost:5000";

const { default: app } = await import("../secure/src/server.js");
const { files, users } = await import("../secure/src/store.js");
const { loginLimiter } = await import("../secure/src/middleware/rateLimit.js");
const {
  isLoginLocked,
  resetSecurityEvents,
} = await import("../secure/src/services/securityEvents.js");

const execFileAsync = promisify(execFile);
const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const secureDirectory = path.resolve(testsDirectory, "..", "secure");
const uploadsDirectory = path.join(secureDirectory, "src", "uploads");
const quarantineDirectory = path.join(secureDirectory, "src", "quarantine");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

async function resetRateLimiter() {
  await Promise.all(
    ["127.0.0.1", "::ffff:127.0.0.1", "::1"].map((key) =>
      loginLimiter.resetKey(key),
    ),
  );
}

async function clearDirectory(directory) {
  const entries = await readdir(directory);

  await Promise.all(
    entries
      .filter((entry) => !entry.startsWith("."))
      .map((entry) => rm(path.join(directory, entry), { recursive: true })),
  );
}

async function clearState() {
  await Promise.all(
    [...files.values()].map((file) => rm(file.path, { force: true })),
  );
  files.clear();
  users.clear();
  resetSecurityEvents();
  await resetRateLimiter();
  await clearDirectory(uploadsDirectory);
  await clearDirectory(quarantineDirectory);
}

beforeEach(clearState);

after(async () => {
  await clearState();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function request(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, options);
  const raw = await response.text();
  let body = raw;

  try {
    body = JSON.parse(raw);
  } catch {
  }

  return { status: response.status, body, raw, response };
}

async function register(user) {
  const result = await request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(user),
  });

  assert.equal(result.status, 201);
  return result.body.user;
}

async function login(email, password) {
  const result = await request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  assert.equal(result.status, 200);
  return result.body.token;
}

function decodeJwt(token) {
  const [encodedHeader, encodedPayload] = token.split(".");

  return {
    header: JSON.parse(Buffer.from(encodedHeader, "base64url").toString()),
    payload: JSON.parse(Buffer.from(encodedPayload, "base64url").toString()),
  };
}

function signJwt(payload, secret) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const unsignedToken = `${header}.${encodedPayload}`;
  const signature = createHmac("sha256", secret)
    .update(unsignedToken)
    .digest("base64url");

  return `${unsignedToken}.${signature}`;
}

async function upload(token, content, filename, mimetype) {
  const form = new FormData();
  form.append("file", new Blob([content], { type: mimetype }), filename);

  return request("/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

test("hashes passwords instead of storing them in clear text", async () => {
  const user = await register({
    username: "alice",
    email: "alice@example.test",
    password: "clear-text-password",
  });
  const storedUser = users.get(user.id);

  assert.equal(storedUser.password, undefined);
  assert.match(storedUser.passwordHash, /^\$2[aby]\$/);
  assert.equal(user.passwordHash, undefined);
});

test("uses the configured JWT secret and an expiration time", async () => {
  const user = await register({
    username: "alice",
    email: "alice@example.test",
    password: "alice-password",
  });
  const token = await login("alice@example.test", "alice-password");
  const decoded = decodeJwt(token);

  assert.equal(decoded.header.alg, "HS256");
  assert.ok(decoded.payload.exp > decoded.payload.iat);

  const forgedWithWeakSecret = signJwt({ sub: user.id }, "secret");
  const forgedResponse = await request("/users/me", {
    headers: { Authorization: `Bearer ${forgedWithWeakSecret}` },
  });

  assert.equal(forgedResponse.status, 401);
});

test("uses an HttpOnly cookie for browser sessions", async () => {
  const user = await register({
    username: "cookie-user",
    email: "cookie-user@example.test",
    password: "cookie-password",
  });
  const result = await request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "cookie-user@example.test",
      password: "cookie-password",
    }),
  });
  const setCookie = result.response.headers.get("set-cookie") ?? "";

  assert.equal(result.status, 200);
  assert.match(setCookie, /campus_session=.*HttpOnly/i);

  const sessionCookie = setCookie.split(";", 1)[0];
  const profile = await request("/users/me", {
    headers: { Cookie: sessionCookie },
  });

  assert.equal(profile.status, 200);
  assert.equal(profile.body.user.id, user.id);
});

test("rejects IDOR access to another user's profile", async () => {
  await register({
    username: "alice",
    email: "alice@example.test",
    password: "alice-password",
  });
  const bob = await register({
    username: "bob",
    email: "bob@example.test",
    password: "bob-password",
  });
  const aliceToken = await login("alice@example.test", "alice-password");

  const result = await request(`/users/${bob.id}`, {
    headers: { Authorization: `Bearer ${aliceToken}` },
  });

  assert.equal(result.status, 403);
});

test("rate-limits repeated login attempts", async () => {
  const statuses = [];

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "rate-limit@example.test",
        password: "wrong-password",
      }),
    });
    statuses.push(result.status);
    resetSecurityEvents();
  }

  assert.deepEqual(statuses.slice(0, 5), [401, 401, 401, 401, 401]);
  assert.equal(statuses[5], 429);
});

test("rejects uploads with invalid type or magic bytes", async () => {
  const user = await register({
    username: "alice",
    email: "alice@example.test",
    password: "alice-password",
  });
  const token = await login("alice@example.test", "alice-password");
  const result = await upload(
    token,
    Buffer.from("this is not a PNG"),
    "payload.png",
    "image/png",
  );

  assert.equal(result.status, 400);
  assert.equal(result.body.error, "File content does not match its extension");
  assert.equal(files.size, 0);
  assert.equal(
    (await readdir(quarantineDirectory)).filter(
      (entry) => !entry.startsWith("."),
    ).length,
    0,
  );
  assert.equal(users.has(user.id), true);
});

test("moves validated files from quarantine to private storage", async () => {
  await register({
    username: "alice",
    email: "alice@example.test",
    password: "alice-password",
  });
  const token = await login("alice@example.test", "alice-password");
  const result = await upload(
    token,
    Buffer.from("%PDF-1.7\nsecure test document"),
    "report.pdf",
    "application/pdf",
  );

  assert.equal(result.status, 201);
  const storedFile = files.get(result.body.file.id);
  assert.ok(storedFile.path.startsWith(uploadsDirectory));
  assert.equal(storedFile.path.includes("quarantine"), false);
  await stat(storedFile.path);
  assert.equal(
    (await readdir(quarantineDirectory)).filter(
      (entry) => !entry.startsWith("."),
    ).length,
    0,
  );
});

test("detects suspicious activity and temporarily locks an identifier", async () => {
  const identifier = "suspicious@example.test";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password: "wrong-password" }),
    });
    assert.equal(result.status, 401);
  }

  assert.equal(isLoginLocked(identifier), true);
  await resetRateLimiter();

  const locked = await request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier, password: "wrong-password" }),
  });

  assert.equal(locked.status, 429);
});

test("does not expose stack traces in client error responses", async () => {
  const result = await request("/route-that-does-not-exist");

  assert.equal(result.status, 404);
  assert.equal(result.body.error, "Not found");
  assert.equal(result.body.stack, undefined);
});

test("passes the production dependency audit", async () => {
  await execFileAsync(
    "pnpm",
    ["audit", "--prod", "--audit-level=high"],
    { cwd: secureDirectory },
  );
});
