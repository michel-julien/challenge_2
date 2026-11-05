import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { createHttpError } from "../middleware/errorHandler.js";
import {
  loginSchema,
  registerSchema,
  validate,
} from "../middleware/validate.js";
import {
  isLoginLocked,
  recordLoginFailure,
  recordLoginSuccess,
} from "../services/securityEvents.js";
import {
  serializeClearedSessionCookie,
  serializeSessionCookie,
} from "../services/sessionCookie.js";
import { publicUser, users } from "../store.js";

const router = express.Router();

router.post(
  "/register",
  validate(registerSchema),
  async (request, response, next) => {
    try {
      const {
        email,
        fullName: requestedFullName,
        password,
        studentId: requestedStudentId,
        username: requestedUsername,
      } = request.body;
      const username = requestedUsername ?? requestedFullName;
      const fullName = requestedFullName ?? requestedUsername;
      const studentId = requestedStudentId ?? username;
      const duplicate = [...users.values()].some(
        (user) =>
          user.email === email ||
          user.username === username ||
          user.studentId === studentId,
      );

      if (duplicate) {
        return next(createHttpError(409, "User already exists"));
      }

      const user = {
        id: randomUUID(),
        username,
        fullName,
        studentId,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role: "student",
        createdAt: new Date().toISOString(),
      };

      users.set(user.id, user);
      return response.status(201).json({ user: publicUser(user) });
    } catch (error) {
      return next(error);
    }
  },
);

router.post("/logout", (_request, response) => {
  response.setHeader("Set-Cookie", serializeClearedSessionCookie());
  return response.status(204).end();
});

router.post(
  "/login",
  validate(loginSchema),
  async (request, response, next) => {
    const { email, identifier, password, username } = request.body;
    const loginIdentifier = identifier ?? email ?? username;

    if (isLoginLocked(loginIdentifier)) {
      return next(createHttpError(429, "Too many login attempts"));
    }

    try {
      const user = [...users.values()].find(
        (candidate) =>
          candidate.email === loginIdentifier ||
          candidate.username === loginIdentifier,
      );
      const passwordMatches = user
        ? await bcrypt.compare(password, user.passwordHash)
        : false;

      if (!user || !passwordMatches) {
        recordLoginFailure(loginIdentifier);
        return next(createHttpError(401, "Invalid credentials"));
      }

      recordLoginSuccess(loginIdentifier);
      const token = jwt.sign(
        { sub: user.id, role: user.role },
        env.jwtSecret,
        { expiresIn: env.jwtExpiresIn, algorithm: "HS256" },
      );

      response.setHeader("Set-Cookie", serializeSessionCookie(token));
      return response.json({ token, user: publicUser(user) });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
