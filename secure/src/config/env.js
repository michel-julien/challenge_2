const nodeEnv = process.env.NODE_ENV;
const jwtSecret = process.env.JWT_SECRET;

if (!nodeEnv) {
  throw new Error("NODE_ENV must be defined");
}

if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error("NODE_ENV must be development, test, or production");
}

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be defined and at least 32 characters long");
}

export const env = Object.freeze({
  nodeEnv,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1h",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5000",
  appHost: process.env.APP_HOST ?? "0.0.0.0",
  appPort: Number(process.env.APP_PORT ?? 5001),
});
