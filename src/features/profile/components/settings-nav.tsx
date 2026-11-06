"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/settings", label: "Profile" },
  { href: "/settings/taste", label: "Taste" },
  { href: "/settings/favorites", label: "Favourite albums" },
  { href: "/settings/preferences", label: "Privacy & notifications" },
  { href: "/settings/account", label: "Account" },
];

export function SettingsNav() {
  return <SettingsNavView pathname={usePathname()} />;
}

export function SettingsNavView({ pathname }: { pathname?: string }) {
  return (
    <nav aria-label="Settings" className="-mx-1 flex gap-1 overflow-x-auto md:mx-0 md:flex-col">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors",
              active
                ? "bg-surface font-medium text-foreground"
                : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
