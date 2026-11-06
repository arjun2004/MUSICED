"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV } from "./nav-config";

export function NavLinks() {
  const pathname = usePathname();
  return <NavLinksView activePath={pathname} />;
}

/** Static render used as the Suspense fallback (no active state). */
export function NavLinksView({ activePath }: { activePath?: string }) {
  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
      {PRIMARY_NAV.map((item) => {
        const active = activePath ? item.match(activePath) : false;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {active ? (
              <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-signal" aria-hidden="true" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
