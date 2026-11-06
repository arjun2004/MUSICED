"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProfileTabs({ username }: { username: string }) {
  const pathname = usePathname();
  return <ProfileTabsView username={username} pathname={pathname} />;
}

export function ProfileTabsView({ username, pathname }: { username: string; pathname?: string }) {
  const base = `/user/${username}`;
  const tabs = [
    { href: base, label: "Profile" },
    { href: `${base}/diary`, label: "Diary" },
    { href: `${base}/reviews`, label: "Reviews" },
    { href: `${base}/lists`, label: "Lists" },
    { href: `${base}/followers`, label: "Followers" },
    { href: `${base}/following`, label: "Following" },
  ];
  return (
    <nav aria-label="Profile sections" className="-mb-px flex gap-6 overflow-x-auto [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] sm:[mask-image:none]">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b-2 py-3 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "border-signal text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
