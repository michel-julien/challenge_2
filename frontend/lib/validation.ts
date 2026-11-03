// Client-side validation is for UX only (fast, inline feedback).
// It is NOT a security control: the backend must validate every request too.
import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Full name is required")
      .max(100, "Full name is too long"),
    studentId: z
      .string()
      .trim()
      .min(1, "Student ID is required")
      .max(20, "Student ID is too long"),
    email: z.email("Enter a valid email address"),
    confirmEmail: z.string().min(1, "Please confirm your email"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password is too long"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine(
    (data) =>
      data.email.trim().toLowerCase() ===
      data.confirmEmail.trim().toLowerCase(),
    { path: ["confirmEmail"], message: "Emails do not match" },
  )
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type FieldErrors<T> = Partial<Record<keyof T, string[]>>;

/** Validates `values` and returns parsed data or per-field error messages. */
export function validate<S extends z.ZodType>(
  schema: S,
  values: unknown,
):
  | { success: true; data: z.output<S> }
  | { success: false; errors: FieldErrors<z.input<S>> } {
  const result = schema.safeParse(values);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: z.flattenError(result.error).fieldErrors as FieldErrors<
      z.input<S>
    >,
  };
}

/** Converts string messages to the shape expected by <FieldError errors>. */
export function toFieldErrors(messages?: string[]) {
  return messages?.map((message) => ({ message }));
}
