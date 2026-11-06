"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert, FormField } from "@/components/shared/form-field";
import { applyFieldErrors } from "@/lib/forms";
import { signInSchema } from "@/lib/validation/auth";
import { resendConfirmation, signIn } from "@/features/authentication/actions";

type Values = z.input<typeof signInSchema>;

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(initialError ?? null);
  const [unconfirmed, setUnconfirmed] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", next },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    setUnconfirmed(false);
    startTransition(async () => {
      const result = await signIn({ ...values, next });
      // On success the action redirects and never returns.
      if (result && !result.ok) {
        setFormError(result.error);
        setUnconfirmed(result.fieldErrors?.email === "Email not confirmed");
        if (result.fieldErrors?.password) applyFieldErrors(result, form.setError);
      }
    });
  });

  function resend() {
    const email = form.getValues("email");
    startTransition(async () => {
      const result = await resendConfirmation({ email });
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {formError ? (
        <FormAlert>
          {formError}
          {unconfirmed ? (
            <button
              type="button"
              onClick={resend}
              className="ml-1 font-medium text-foreground underline underline-offset-2"
            >
              Resend link
            </button>
          ) : null}
        </FormAlert>
      ) : null}

      <FormField label="Email" error={errors.email?.message}>
        {(field) => (
          <Input
            {...field}
            {...form.register("email")}
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            className="h-10"
          />
        )}
      </FormField>

      <FormField
        label="Password"
        error={errors.password?.message}
        labelAside={
          <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
            Forgot password?
          </Link>
        }
      >
        {(field) => (
          <Input
            {...field}
            {...form.register("password")}
            type="password"
            autoComplete="current-password"
            className="h-10"
          />
        )}
      </FormField>

      <Button type="submit" className="mt-2 h-10 font-semibold" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
