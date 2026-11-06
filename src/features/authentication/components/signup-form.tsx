"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert, FormField } from "@/components/shared/form-field";
import { applyFieldErrors } from "@/lib/forms";
import { signUpSchema } from "@/lib/validation/auth";
import { signUp } from "@/features/authentication/actions";
import { UsernameInput } from "./username-input";

type Values = z.input<typeof signUpSchema>;

export function SignupForm() {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", username: "", password: "" },
    mode: "onTouched",
  });
  const { errors } = form.formState;
  const watchedUsername = useWatch({ control: form.control, name: "username" }) ?? "";

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await signUp(values);
      if (!result) return; // redirected
      if (result.ok) {
        setSentTo(result.data.email);
      } else {
        setFormError(result.error);
        applyFieldErrors(result, form.setError);
      }
    });
  });

  if (sentTo) {
    return (
      <div className="animate-fade-up text-center">
        <span className="mx-auto mb-5 inline-flex size-12 items-center justify-center rounded-full bg-signal/10 text-signal">
          <MailCheck className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-semibold tracking-tight">Check your inbox</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a confirmation link to <span className="text-foreground">{sentTo}</span>. Open it
          to activate your account and start your diary.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {formError ? <FormAlert>{formError}</FormAlert> : null}

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

      <UsernameInput
        registration={form.register("username")}
        error={errors.username?.message}
        watchValue={watchedUsername}
      />

      <FormField
        label="Password"
        error={errors.password?.message}
        hint="At least 8 characters, with a letter and a number."
      >
        {(field) => (
          <Input
            {...field}
            {...form.register("password")}
            type="password"
            autoComplete="new-password"
            className="h-10"
          />
        )}
      </FormField>

      <Button type="submit" className="mt-2 h-10 font-semibold" disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        By joining you agree to keep it about the music, and to be kind.
      </p>
    </form>
  );
}
