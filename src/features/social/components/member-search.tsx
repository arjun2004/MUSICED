"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Debounced search that syncs to `?q=` so results are shareable. */
export function MemberSearch({
  placeholder = "Search by name or username",
  label = "Search listeners",
}: {
  placeholder?: string;
  label?: string;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (value.trim() === current) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams();
      if (value.trim()) next.set("q", value.trim());
      startTransition(() => {
        router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, params, pathname, router]);

  return (
    <div className="relative w-full sm:w-80">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        maxLength={120}
        className="h-9 pl-9"
      />
      {pending ? (
        <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : null}
    </div>
  );
}
