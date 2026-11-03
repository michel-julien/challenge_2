import jwt from "jsonwebtoken";

const JWT_SECRET = "secret";

export function authenticate(request, response, next) {
  const authorization = request.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return response.status(401).json({ error: "Missing bearer token" });
  }

  const token = authorization.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    request.userId = payload.userId;
    return next();
  } catch {
    return response.status(401).json({ error: "Invalid token" });
  }
}

export { JWT_SECRET };
