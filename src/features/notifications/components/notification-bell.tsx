"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Header bell with a live unread count. Subscribes to the viewer's own
 * notification inserts via Supabase Realtime (RLS limits events to rows the
 * viewer can read). Visiting /notifications clears the badge.
 */
export function NotificationBell({ userId, initialCount }: { userId: string; initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const pathname = usePathname();
  const onPage = pathname === "/notifications";

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        () => setCount((n) => n + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const shown = onPage ? 0 : count;

  return (
    <Link
      href="/notifications"
      onClick={() => setCount(0)}
      className="relative inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
      aria-label={shown > 0 ? `Notifications, ${shown} unread` : "Notifications"}
    >
      <Bell className="size-[18px]" aria-hidden="true" />
      {shown > 0 ? (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 font-mono text-[0.625rem] font-semibold text-signal-foreground",
          )}
          aria-hidden="true"
        >
          {shown > 99 ? "99+" : shown}
        </span>
      ) : null}
    </Link>
  );
}
