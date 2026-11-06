"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert, FormField } from "@/components/shared/form-field";
import { applyFieldErrors } from "@/lib/forms";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation/auth";
import { requestPasswordReset, updatePassword } from "@/features/authentication/actions";

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const form = useForm<z.input<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      const result = await requestPasswordReset(values);
      setMessage(
        result.ok
          ? { tone: "success", text: result.message ?? "Check your inbox." }
          : { tone: "error", text: result.error },
      );
      if (result.ok) form.reset();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {message ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}
      <FormField label="Email" error={form.formState.errors.email?.message}>
        {(field) => (
          <Input
            {...field}
            {...form.register("email")}
            type="email"
            autoComplete="email"
            autoFocus
            className="h-10"
          />
        )}
      </FormField>
      <Button type="submit" className="mt-2 h-10 font-semibold" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.input<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await updatePassword(values);
      if (result && !result.ok) {
        setFormError(result.error);
        applyFieldErrors(result, form.setError);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <FormField
        label="New password"
        error={errors.password?.message}
        hint="At least 8 characters, with a letter and a number."
      >
        {(field) => (
          <Input
            {...field}
            {...form.register("password")}
            type="password"
            autoComplete="new-password"
            autoFocus
            className="h-10"
          />
        )}
      </FormField>
      <FormField label="Confirm new password" error={errors.confirmPassword?.message}>
        {(field) => (
          <Input
            {...field}
            {...form.register("confirmPassword")}
            type="password"
            autoComplete="new-password"
            className="h-10"
          />
        )}
      </FormField>
      <Button type="submit" className="mt-2 h-10 font-semibold" disabled={pending}>
        {pending ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}
