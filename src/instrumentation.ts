/**
 * Server error monitoring hook. Every uncaught server error (render, route
 * handler, server action, proxy) passes through here.
 *
 * It always emits one structured JSON log line (indexed by Vercel log drains or
 * any log pipeline). If ERROR_WEBHOOK_URL is set, the same payload is POSTed
 * there — point it at Sentry/Better Stack/Slack ingest or your own collector.
 * No PII is captured: no headers, cookies, bodies or query strings.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string; renderSource?: string },
) {
  const err = error instanceof Error ? error : new Error(String(error));
  const digest =
    typeof (error as { digest?: unknown })?.digest === "string" ? (error as { digest: string }).digest : undefined;

  // Aborted renders (navigations away, reloads) are not errors.
  if (err.name === "AbortError" || err.message.startsWith("AbortError")) return;

  const payload = {
    level: "error",
    source: "musiced-server",
    message: err.message,
    name: err.name,
    digest,
    method: request.method,
    path: request.path.split("?")[0],
    route: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    stack: process.env.NODE_ENV === "production" ? err.stack?.split("\n").slice(0, 6).join("\n") : err.stack,
  };
  console.error(JSON.stringify(payload));

  const webhook = process.env.ERROR_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app: "musiced", env: process.env.VERCEL_ENV ?? process.env.NODE_ENV, ...payload }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Monitoring must never break a request.
  }
}
