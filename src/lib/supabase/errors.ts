type QueryError = { message: string; hint?: string | null; code?: string | null } | null;

/**
 * postgrest-js turns a cancelled fetch into a normal `{ error }` result whose
 * message starts with "AbortError". That happens when Next.js abandons a
 * render (navigation away, reload mid-stream, HMR, dev-time prerender
 * validation). The render's output is discarded, so it is not a failure.
 */
export function isAbortError(error: QueryError): boolean {
  if (!error) return false;
  return (
    error.message.startsWith("AbortError") ||
    error.message.startsWith("TimeoutError") ||
    (error.hint ?? "").startsWith("Request was aborted")
  );
}

/**
 * Throws for real query failures; returns for aborted requests so callers fall
 * through to their empty-data defaults (`data ?? []`).
 */
export function assertQuery(error: QueryError, label: string): void {
  if (error && !isAbortError(error)) {
    throw new Error(`Failed to load ${label}: ${error.message}`);
  }
}
