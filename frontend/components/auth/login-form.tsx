"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import {
  loginSchema,
  toFieldErrors,
  validate,
  type FieldErrors,
} from "@/lib/validation";
import { useAuth } from "./auth-provider";

type Values = { email: string; password: string };

export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const { login } = useAuth();
  const [values, setValues] = useState<Values>({ email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors<Values>>({});
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);

  function update(field: keyof Values, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    // After the first submit attempt, re-validate as the user types.
    if (submitted) {
      const result = validate(loginSchema, next);
      setErrors(result.success ? {} : result.errors);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    // Client-side validation is for UX only; the backend must validate too.
    const result = validate(loginSchema, values);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const user = await login(result.data);
      toast.success(`Welcome back, ${user.fullName}`);
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError && (err.status === 401 || err.status === 400)
          ? "Invalid email or password"
          : "Something went wrong. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup className="gap-4">
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="login-email">Email</FieldLabel>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@campus.edu"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            aria-invalid={!!errors.email}
            disabled={pending}
          />
          <FieldError errors={toFieldErrors(errors.email)} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="login-password">Password</FieldLabel>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={(e) => update("password", e.target.value)}
            aria-invalid={!!errors.password}
            disabled={pending}
          />
          <FieldError errors={toFieldErrors(errors.password)} />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          {pending ? "Logging in…" : "Log in"}
        </Button>
      </FieldGroup>
    </form>
  );
}
