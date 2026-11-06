"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const MESSAGES: Record<string, string> = {
  welcome: "Welcome to MUSICED. Your diary is ready.",
  password: "Password updated.",
  deleted: "Your account and its data have been deleted.",
};

/**
 * Shows one-off confirmations passed via query flags (e.g. after redirects
 * from server actions), then removes the flag from the URL.
 * Must be rendered inside <Suspense> (reads search params).
 */
export function UrlToasts() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const flags = Object.keys(MESSAGES).filter((key) => params.has(key));
    if (flags.length === 0) return;
    for (const flag of flags) toast.success(MESSAGES[flag]);
    const next = new URLSearchParams(params);
    for (const flag of flags) next.delete(flag);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return null;
}
