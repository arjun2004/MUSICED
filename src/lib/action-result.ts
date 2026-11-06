import type { z } from "zod";

/**
 * Uniform return shape for Server Actions consumed by forms.
 * `fieldErrors` map onto react-hook-form fields.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Maps the suspension trigger's error to a clear message; null otherwise. */
export function suspendedError(error: { message?: string } | null | undefined): ActionResult<never> | null {
  return error?.message?.includes("suspended")
    ? fail("Your account is suspended, so you can't post or change things right now.")
    : null;
}

export function fromZodError(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fail("Please fix the highlighted fields.", fieldErrors);
}
