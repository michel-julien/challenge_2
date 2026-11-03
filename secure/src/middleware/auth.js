import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { createHttpError } from "./errorHandler.js";
import { users } from "../store.js";

export function authenticate(request, _response, next) {
  const authorization = request.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return next(createHttpError(401, "Authentication required"));
  }

  const token = authorization.slice("Bearer ".length);

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
