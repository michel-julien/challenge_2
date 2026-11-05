import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { readSessionCookie } from "../services/sessionCookie.js";
import { createHttpError } from "./errorHandler.js";
import { users } from "../store.js";

export function authenticate(request, _response, next) {
  const authorization = request.get("authorization");

  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const token = bearerToken ?? readSessionCookie(request);

  if (!token) {
    return next(createHttpError(401, "Authentication required"));
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
    });
    const user = users.get(payload.sub);

    if (!user) {
      return next(createHttpError(401, "Authentication required"));
    }

    request.user = user;
    return next();
  } catch {
    return next(createHttpError(401, "Invalid or expired token"));
  }
}
