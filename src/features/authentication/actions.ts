"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { checkRateLimit, clientFingerprint } from "@/lib/rate-limit";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type SignInInput,
  type SignUpInput,
} from "@/lib/validation/auth";

const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";

export async function signUp(
  input: SignUpInput,
): Promise<ActionResult<{ needsConfirmation: boolean; email: string }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const limit = await checkRateLimit("signUp", await clientFingerprint());
  if (!limit.allowed) return fail(TOO_MANY);

  const { email, username, password } = parsed.data;
  const supabase = await createClient();

  // Friendly early check. The database is the source of truth (unique index).
  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (taken) return fail("That username is taken.", { username: "That username is taken" });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return fail(error.message, { password: error.message });
    }
    if (error.code === "over_email_send_rate_limit" || error.status === 429) return fail(TOO_MANY);
    console.error("[auth] signUp failed", error.code, error.message);
    return fail("We couldn't create your account. Please try again.");
  }

  // With confirmations on there is no session yet. For an already-registered
  // email Supabase returns an obfuscated user; we show the same message so
  // account existence is not revealed.
  if (!data.session) return ok({ needsConfirmation: true, email });

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function signIn(input: SignInInput): Promise<ActionResult<{ unconfirmed?: boolean }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const limit = await checkRateLimit("signIn", await clientFingerprint());
  if (!limit.allowed) return fail(TOO_MANY);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        ok: false,
        error: "Please confirm your email first. We can resend the link if you need it.",
        fieldErrors: { email: "Email not confirmed" },
      };
    }
    if (error.status === 429) return fail(TOO_MANY);
    return fail("That email and password don't match an account.");
  }

  revalidatePath("/", "layout");
  redirect(safeRedirectPath(parsed.data.next, "/"));
}

export async function resendConfirmation(input: ForgotPasswordInput): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const limit = await checkRateLimit("passwordReset", await clientFingerprint());
  if (!limit.allowed) return fail(TOO_MANY);

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=/onboarding`,
    },
  });
  if (error && error.status === 429) return fail(TOO_MANY);
  return ok(undefined, "If that account is waiting for confirmation, a new link is on its way.");
}

export async function signInWithGoogle(next?: string): Promise<ActionResult<never>> {
  if (!publicEnv().NEXT_PUBLIC_AUTH_GOOGLE_ENABLED) {
    return fail("Google sign-in is not enabled.");
  }
  const supabase = await createClient();
  const callback = new URL("/auth/callback", publicEnv().NEXT_PUBLIC_SITE_URL);
  callback.searchParams.set("next", safeRedirectPath(next, "/"));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString() },
  });
  if (error || !data.url) {
    console.error("[auth] Google OAuth failed", error?.message);
    return fail("Google sign-in is unavailable right now.");
  }
  redirect(data.url);
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const limit = await checkRateLimit("passwordReset", await clientFingerprint());
  if (!limit.allowed) return fail(TOO_MANY);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });
  if (error && error.status === 429) return fail(TOO_MANY);
  if (error) console.error("[auth] reset request failed", error.code, error.message);

  // Same response whether or not the account exists.
  return ok(undefined, "If an account exists for that email, a reset link is on its way.");
}

export async function updatePassword(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return fail("Your reset link has expired. Request a new one.");
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return fail("Choose a password you haven't used here before.", {
        password: "Must differ from your current password",
      });
    }
    if (error.code === "weak_password") return fail(error.message, { password: error.message });
    return fail("We couldn't update your password. Please try again.");
  }

  revalidatePath("/", "layout");
  redirect("/?password=updated");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
