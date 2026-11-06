"use client";

import { timeAgo } from "@/lib/utils/format";

/**
 * "3h" / "2d" style timestamps. A client component on purpose: reading the
 * clock in a Server Component breaks prerendering under Cache Components, and
 * the browser's clock is the right reference for "how long ago" anyway.
 */
export function RelativeTime({ iso, suffix = "", className }: { iso: string; suffix?: string; className?: string }) {
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()} className={className} suppressHydrationWarning>
      {timeAgo(iso)}
      {suffix}
    </time>
  );
}
