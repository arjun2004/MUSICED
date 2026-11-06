import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ActionResult } from "@/lib/action-result";

/** Push server-side field errors from an ActionResult into react-hook-form. */
export function applyFieldErrors<T extends FieldValues>(
  result: ActionResult<unknown>,
  setError: UseFormSetError<T>,
) {
  if (result.ok || !result.fieldErrors) return;
  for (const [field, message] of Object.entries(result.fieldErrors)) {
    setError(field as Path<T>, { type: "server", message });
  }
}
