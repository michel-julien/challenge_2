import express from "express";
import jwt from "jsonwebtoken";

import { randomUUID } from "node:crypto";
import { publicUser, users } from "../db.js";
import { JWT_SECRET } from "../middleware/auth.js";
import {
  serializeClearedSessionCookie,
  serializeSessionCookie,
} from "../middleware/sessionCookie.js";

const router = express.Router();

router.post("/register", (request, response) => {
  const { email, password } = request.body ?? {};
  const username = request.body?.username ?? request.body?.name;
  const fullName = request.body?.fullName ?? username;
  const studentId = request.body?.studentId ?? username;

  const user = {
    id: randomUUID(),
    username,
    fullName,
    studentId,
    email,
    password,
    createdAt: new Date().toISOString(),
  };

  users.set(user.id, user);

  return response.status(201).json({ user: publicUser(user) });
});

router.post("/logout", (_request, response) => {
  response.setHeader("Set-Cookie", serializeClearedSessionCookie());
  return response.status(204).end();
});

router.post("/login", (request, response) => {
  const { email, identifier, password, username } = request.body ?? {};
  const loginIdentifier = identifier ?? email ?? username;

  const user = [...users.values()].find(
    (candidate) =>
      candidate.email === loginIdentifier ||
      candidate.username === loginIdentifier,
  );

  if (!user || user.password !== password) {
    return response.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET);

  response.setHeader("Set-Cookie", serializeSessionCookie(token));
  return response.json({ token, user: publicUser(user) });
});

export default router;
