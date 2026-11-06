import Link from "next/link";
import { Suspense } from "react";
import { Bell } from "lucide-react";
import { AlbumCover } from "@/components/albums/album-cover";
import { UserAvatar } from "@/components/profile/user-avatar";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import { requireViewer } from "@/lib/auth/session";
import { getNotifications, type NotificationItem } from "@/features/notifications/queries";
import { MarkAllRead } from "@/features/notifications/components/mark-all-read";
import { RelativeTime } from "@/components/shared/relative-time";

export const metadata = { title: "Notifications", robots: { index: false } };

export default function NotificationsPage() {
  return (
    <div className="container-page max-w-3xl">
      <PageHeader eyebrow="Inbox" title="Notifications" />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <Body />
      </Suspense>
    </div>
  );
}

function describe(n: NotificationItem): { text: string; href: string } {
  const album = n.review?.album.title;
  switch (n.type) {
    case "followed":
      return { text: "started following you", href: `/user/${n.actor.username}` };
    case "liked_review":
      return { text: `liked your review of ${album ?? "an album"}`, href: `/review/${n.review?.id}` };
    case "commented_review":
      return { text: `commented on your review of ${album ?? "an album"}`, href: `/review/${n.review?.id}#comments-heading` };
    case "replied_comment":
      return { text: "replied to your comment", href: `/review/${n.review?.id}#comments-heading` };
    case "liked_comment":
      return { text: "liked your comment", href: `/review/${n.review?.id}#comments-heading` };
    case "liked_list":
      return { text: `liked your list “${n.list?.title ?? ""}”`, href: `/list/${n.list?.id}` };
    case "mentioned":
      return { text: n.comment ? "mentioned you in a comment" : "mentioned you in a review", href: `/review/${n.review?.id}` };
  }
}

async function Body() {
  const viewer = await requireViewer("/notifications");
  const items = await getNotifications(viewer.id);
  const unread = items.filter((n) => !n.read_at).length;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="Nothing yet"
        description="Follows, likes, comments and @mentions will show up here."
        action={{ label: "Find listeners", href: "/members" }}
      />
    );
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <p className="eyebrow">{unread > 0 ? `${unread} unread` : "All caught up"}</p>
        {unread > 0 ? <MarkAllRead /> : null}
      </div>
      <ol className="divide-y divide-hairline">
        {items.map((n) => {
          const { text, href } = describe(n);
          return (
            <li key={n.id}>
              <Link
                href={href}
                className={cn("flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-surface", !n.read_at && "bg-signal/[0.04]")}
              >
                <span className={cn("size-1.5 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-signal")} aria-hidden="true" />
                <UserAvatar user={n.actor} size="md" />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{n.actor.display_name || n.actor.username}</span>{" "}
                  <span className="text-muted-foreground">{text}</span>
                  {n.comment ? (
                    <span className="mt-0.5 block truncate text-[0.8125rem] text-foreground/75">“{n.comment.body}”</span>
                  ) : null}
                  <span className="mt-0.5 block font-mono text-xs text-muted-foreground/70">
                    <RelativeTime iso={n.created_at} suffix=" ago" />
                    {!n.read_at ? <span className="sr-only"> · unread</span> : null}
                  </span>
                </span>
                {n.review?.album ? (
                  <span className="w-11 shrink-0">
                    <AlbumCover src={n.review.album.cover_url} title={n.review.album.title} artist={n.review.album.artist_credit} sizes="44px" />
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}
