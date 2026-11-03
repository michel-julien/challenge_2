import { logger } from "../services/logger.js";

export function createHttpError(statusCode, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

export function errorHandler(error, request, response, next) {
  logger.error(
    {
      err: error,
      method: request.method,
      path: request.originalUrl,
    },
    "Request failed",
  );

  if (response.headersSent) {
    return next(error);
  }

  const statusCode =
    error.statusCode ??
    error.status ??
    (error.name === "MulterError" ? 400 : 500);
  const message = statusCode >= 500 ? "Internal server error" : error.message;

  return response.status(statusCode).json({ error: message });
}
