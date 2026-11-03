"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import {
  registerSchema,
  toFieldErrors,
  validate,
  type FieldErrors,
} from "@/lib/validation";
import { useAuth } from "./auth-provider";

type Values = {
  fullName: string;
  studentId: string;
  email: string;
  confirmEmail: string;
  password: string;
  confirmPassword: string;
};

const initialValues: Values = {
  fullName: "",
  studentId: "",
  email: "",
  confirmEmail: "",
  password: "",
  confirmPassword: "",
};

const fields: {
  name: keyof Values;
  label: string;
  type: string;
  autoComplete: string;
  placeholder?: string;
  description?: string;
}[] = [
  { name: "fullName", label: "Full name", type: "text", autoComplete: "name", placeholder: "Jane Doe" },
  { name: "studentId", label: "Student ID", type: "text", autoComplete: "off", placeholder: "S1234567" },
  { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@campus.edu" },
  { name: "confirmEmail", label: "Confirm email", type: "email", autoComplete: "email", placeholder: "you@campus.edu" },
  { name: "password", label: "Password", type: "password", autoComplete: "new-password", description: "At least 8 characters." },
  { name: "confirmPassword", label: "Confirm password", type: "password", autoComplete: "new-password" },
];

export function RegisterForm({ onSuccess }: { onSuccess?: () => void }) {
  const { register } = useAuth();
  const [values, setValues] = useState<Values>(initialValues);
  const [errors, setErrors] = useState<FieldErrors<Values>>({});
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);

  function update(field: keyof Values, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    if (submitted) {
      const result = validate(registerSchema, next);
      setErrors(result.success ? {} : result.errors);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    const result = validate(registerSchema, values);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setPending(true);
    const { fullName, studentId, email, password } = result.data;
    try {
      const user = await register({ fullName, studentId, email, password });
      toast.success(`Account created. Welcome, ${user.fullName}!`);
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status >= 400 && err.status < 500
          ? "Registration failed. Please check your details and try again."
          : "Something went wrong. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup className="gap-4">
        {fields.map((f) => {
          const id = `register-${f.name}`;
          return (
            <Field key={f.name} data-invalid={!!errors[f.name]}>
              <FieldLabel htmlFor={id}>{f.label}</FieldLabel>
              <Input
                id={id}
                type={f.type}
                autoComplete={f.autoComplete}
                placeholder={f.placeholder}
                value={values[f.name]}
                onChange={(e) => update(f.name, e.target.value)}
                aria-invalid={!!errors[f.name]}
                disabled={pending}
              />
              {f.description && !errors[f.name] && (
                <FieldDescription>{f.description}</FieldDescription>
              )}
              <FieldError errors={toFieldErrors(errors[f.name])} />
            </Field>
          );
        })}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </FieldGroup>
    </form>
  );
}
