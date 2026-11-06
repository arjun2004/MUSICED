import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();
const supabaseWs = supabaseOrigin.replace(/^http/, "ws");

/**
 * Content-Security-Policy without nonces: nonce-based CSP is incompatible with
 * the prerendered static shells (Partial Prerendering) this app relies on, so
 * inline scripts are allowed but everything else is locked down — no plugins,
 * no framing, no foreign scripts/connections, images only from our sources.
 * See docs/ARCHITECTURE.md ("CSP").
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://coverartarchive.org https://*.archive.org https://archive.org ${supabaseOrigin}`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}${isDev ? " ws: http://127.0.0.1:* http://localhost:*" : ""}`,
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  // Server actions post to self; Supabase OAuth starts with a redirect, not a form post.
  "form-action 'self'",
  // Only when the backend is HTTPS (a local production run talks to http://127.0.0.1).
  ...(!isDev && supabaseOrigin.startsWith("https:") ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // Album artwork comes from the Cover Art Archive, which redirects to
    // archive.org mirrors.
    remotePatterns: [
      { protocol: "https", hostname: "coverartarchive.org" },
      { protocol: "https", hostname: "archive.org" },
      { protocol: "https", hostname: "**.archive.org" },
    ],
    qualities: [75, 90],
  },
  experimental: {
    serverActions: {
      // Avatar uploads are capped at 2 MB; leave room for multipart overhead.
      bodySizeLimit: "2.5mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [{ source: "/discover", destination: "/", permanent: false }];
  },
};

export default nextConfig;
