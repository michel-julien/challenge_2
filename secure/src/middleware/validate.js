import { z } from "zod";

import { createHttpError } from "./errorHandler.js";

export const registerSchema = z
  .object({
    username: z.string().min(3).max(50),
    email: z.string().email(),
    password: z.string().min(8).max(128),
  })
  .strict();

export const loginSchema = z
  .object({
    identifier: z.string().min(1).optional(),
    email: z.string().email().optional(),
    username: z.string().min(3).max(50).optional(),
    password: z.string().min(1).max(128),
  })
  .strict()
  .refine(
    (value) => Boolean(value.identifier || value.email || value.username),
    "email, username, or identifier is required",
  );

export const idSchema = z
  .object({ id: z.string().uuid() })
  .strict();

export function validate(schema, source = "body") {
  return (request, _response, next) => {
    const result = schema.safeParse(request[source]);

    if (!result.success) {
      return next(
        createHttpError(400, "Invalid request", result.error.issues),
      );
    }

    request[source] = result.data;
    return next();
  };
}
