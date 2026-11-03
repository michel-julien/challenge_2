import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { once } from "node:events";
import { after, before, beforeEach, test } from "node:test";

import app from "../unsecure/src/app.js";
import { files, users } from "../unsecure/src/db.js";

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

async function clearState() {
  await Promise.all(
    [...files.values()].map((file) => rm(file.path, { force: true })),
  );
  files.clear();
  users.clear();
}

beforeEach(clearState);

after(async () => {
  await clearState();
  server.close();
  await once(server, "close");
});

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const raw = await response.text();
  let body = raw;

  try {
    body = JSON.parse(raw);
  } catch {
  }

  return { status: response.status, body, raw };
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

function forgeJwt(payload, secret) {
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

async function uploadFile(token, filename = "payload.exe") {
  const form = new FormData();
  form.append(
    "file",
    new Blob([Buffer.alloc(1024 * 1024, "x")], {
      type: "application/x-unknown",
    }),
    filename,
  );

  return request("/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

test("accepts missing registration fields without input validation", async () => {
  const result = await request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });

  assert.equal(result.status, 201);
  assert.equal(users.size, 1);
});

test("stores the user's password in clear text", async () => {
  const user = await register({
    username: "alice",
    email: "alice@example.test",
    password: "clear-text-password",
  });

  assert.equal(users.get(user.id).password, "clear-text-password");
});

test("accepts a forged JWT signed with the weak secret and has no expiration", async () => {
  const user = await register({
    username: "alice",
    email: "alice@example.test",
    password: "password",
  });
  const loginToken = await login("alice@example.test", "password");
  const decoded = decodeJwt(loginToken);

  assert.equal(decoded.header.alg, "HS256");
  assert.equal(decoded.payload.exp, undefined);

  const forgedToken = forgeJwt(
    { userId: user.id, role: "administrator" },
    "secret",
  );
  const result = await request("/users/me", {
    headers: { Authorization: `Bearer ${forgedToken}` },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.user.id, user.id);
});

test("allows an authenticated user to read another user's profile", async () => {
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

  assert.equal(result.status, 200);
  assert.equal(result.body.user.id, bob.id);
  assert.equal(result.body.user.username, "bob");
});

test("does not rate-limit repeated failed login attempts", async () => {
  await register({
    username: "alice",
    email: "alice@example.test",
    password: "correct-password",
  });

  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      request("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "alice@example.test",
          password: "wrong-password",
        }),
      }),
    ),
  );

  assert.ok(results.every((result) => result.status === 401));
  assert.equal(results.some((result) => result.status === 429), false);
});

test("accepts an arbitrary file type, size, and filename", async () => {
  await register({
    username: "alice",
    email: "alice@example.test",
    password: "password",
  });
  const token = await login("alice@example.test", "password");
  const result = await uploadFile(token, "../../payload.exe");

  assert.equal(result.status, 201);
  assert.equal(result.body.file.mimetype, "application/x-unknown");
  assert.equal(result.body.file.originalName, "payload.exe");
  assert.equal(result.body.file.size, 1024 * 1024);
});

test("serves an uploaded file without access control", async () => {
  await register({
    username: "alice",
    email: "alice@example.test",
    password: "password",
  });
  const token = await login("alice@example.test", "password");
  const upload = await uploadFile(token);

  const result = await request(`/files/${upload.body.file.id}`);

  assert.equal(result.status, 200);
  assert.equal(result.raw.length, 1024 * 1024);
});

test("returns a stack trace to the client on errors", async () => {
  const result = await request("/route-that-does-not-exist");

  assert.equal(result.status, 404);
  assert.match(result.body.stack, /Error: Cannot GET \/route-that-does-not-exist/);
});

test("pins legacy dependency versions for the vulnerability report", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../unsecure/package.json", import.meta.url), "utf8"),
  );

  assert.equal(packageJson.dependencies.express, "4.17.1");
  assert.equal(packageJson.dependencies.jsonwebtoken, "8.5.1");
  assert.equal(packageJson.dependencies.multer, "1.4.5-lts.1");
});
