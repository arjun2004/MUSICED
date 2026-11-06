"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV } from "./nav-config";

/** Bottom tab bar for small screens. `username` is null when signed out. */
export function MobileTabBar({ username }: { username: string | null }) {
  const pathname = usePathname();
  const profileHref = username ? `/user/${username}` : "/login";
  const ProfileIcon = username ? UserRound : LogIn;
  const items = [
    ...PRIMARY_NAV.filter((item) => item.mobile).map((item) => ({
      href: item.href,
      label: item.label,
      icon: item.icon,
      active: item.match(pathname) && !(username && pathname.startsWith(`/user/${username}`)),
    })),
    {
      href: profileHref,
      label: username ? "You" : "Sign in",
      icon: ProfileIcon,
      active: username ? pathname.startsWith(`/user/${username}`) : pathname === "/login",
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map((item) => (
          <li key={item.label} className="flex-1">
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-medium transition-colors",
                item.active ? "text-signal" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
