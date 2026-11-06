import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getViewerProfile } from "@/lib/auth/session";
import { UserMenu } from "./user-menu";
import { getUnreadCount } from "@/features/notifications/actions";
import { NotificationBell } from "@/features/notifications/components/notification-bell";

/** Reads the session; always render inside <Suspense>. */
export async function HeaderAccount() {
  const profile = await getViewerProfile();

  if (!profile) {
    return (
      <div className="flex items-center gap-1.5">
        <Button asChild variant="ghost" size="sm" className="h-8 px-3">
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild size="sm" className="h-8 px-3 font-semibold">
          <Link href="/signup">Join MUSICED</Link>
        </Button>
      </div>
    );
  }

  const unread = await getUnreadCount();
  return (
    <div className="flex items-center gap-2">
      <NotificationBell userId={profile.id} initialCount={unread} />
      <UserMenu
      profile={{
        username: profile.username,
        display_name: profile.display_name,
        avatar_path: profile.avatar_path,
        onboarded: Boolean(profile.username && profile.onboarded_at),
        isStaff: profile.role === "moderator" || profile.role === "admin",
      }}
      />
    </div>
  );
}

export function HeaderAccountSkeleton() {
  return <Skeleton className="size-8 rounded-full" />;
}
