import jwt from "jsonwebtoken";

import { readSessionCookie } from "./sessionCookie.js";

const JWT_SECRET = "secret";

export function authenticate(request, response, next) {
  const authorization = request.get("authorization");

  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const token = bearerToken ?? readSessionCookie(request);

  if (!token) {
    return response.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    request.userId = payload.userId;
    return next();
  } catch {
    return response.status(401).json({ error: "Invalid token" });
  }
}

export { JWT_SECRET };
