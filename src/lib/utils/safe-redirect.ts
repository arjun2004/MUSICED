/**
 * Only allow same-site relative redirect targets. Prevents open redirects via
 * `?next=https://evil.example` or protocol-relative `//evil.example`.
 */
export function safeRedirectPath(target: unknown, fallback = "/"): string {
  if (typeof target !== "string" || target.length === 0 || target.length > 512) return fallback;
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) {
    return fallback;
  }
  try {
    const url = new URL(target, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
