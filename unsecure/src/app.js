import express from "express";

import authRoutes from "./routes/auth.js";
import fileRoutes from "./routes/files.js";
import userRoutes from "./routes/users.js";

const app = express();
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5000";

app.use((request, response, next) => {
  const origin = request.get("origin");

  if (origin && origin !== corsOrigin) {
    return response.status(403).json({ error: "Origin is not allowed" });
  }

  response.setHeader("Access-Control-Allow-Origin", origin ?? corsOrigin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Vary", "Origin");

  if (request.method === "OPTIONS") {
    return response.sendStatus(204);
  }

  return next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "unsecure" });
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/files", fileRoutes);

app.use((request, _response, next) => {
  const error = new Error(`Cannot ${request.method} ${request.originalUrl}`);
  error.status = 404;
  next(error);
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.status ?? 500).json({
    error: error.message,
    stack: error.stack,
  });
});

export default app;
