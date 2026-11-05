import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { authenticate } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { loginLimiter } from "./middleware/rateLimit.js";
import authRoutes from "./routes/auth.js";
import fileRoutes from "./routes/files.js";
import userRoutes from "./routes/users.js";

export const app = express();
const allowedOrigins = env.corsOrigin
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS origin is not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization"],
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "secure" });
});

app.use("/auth/login", loginLimiter);
app.use("/auth", authRoutes);
app.use("/users", authenticate, userRoutes);
app.use("/files", authenticate, fileRoutes);

app.use((request, _response, next) => {
  const error = new Error(`Cannot ${request.method} ${request.originalUrl}`);
  error.statusCode = 404;
  next(error);
});

app.use(errorHandler);

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  app.listen(env.appPort, env.appHost, () => {
    console.log(`Secure API listening on http://${env.appHost}:${env.appPort}`);
  });
}

export default app;
