import Link from "next/link";
import { AlbumCover } from "@/components/albums/album-cover";
import { UserAvatar } from "@/components/profile/user-avatar";
import { StarRating } from "@/components/shared/star-rating";
import type { FeedItem } from "@/types/domain";
import { RelativeTime } from "@/components/shared/relative-time";

function verb(item: FeedItem): string {
  const actions = item.actions ?? [item.type];
  const listened = actions.includes("logged");
  const reviewed = actions.includes("reviewed");
  const rated = actions.includes("rated");
  if (reviewed) return listened ? "listened to and reviewed" : "reviewed";
  if (listened && rated) return "listened to and rated";
  switch (item.type) {
    case "rated":
      return "rated";
    case "logged":
      return "listened to";
    case "reviewed":
      return "reviewed";
    case "created_list":
      return "created a list";
    case "liked_review":
      return "liked a review of";
    case "liked_list":
      return "liked a list";
    case "followed":
      return "started following";
  }
}

function ProfileLink({ user }: { user: { username: string; display_name: string | null } }) {
  return (
    <Link href={`/user/${user.username}`} className="font-medium text-foreground hover:text-signal">
      {user.display_name || user.username}
    </Link>
  );
}

export function ActivityItem({ item }: { item: FeedItem }) {
  const { actor, album } = item;
  return (
    <article className="flex gap-3 py-4">
      <Link href={`/user/${actor.username}`} className="shrink-0 self-start rounded-full">
        <UserAvatar user={actor} size="sm" />
      </Link>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-muted-foreground">
          <ProfileLink user={actor} /> {verb(item)}{" "}
          {album ? (
            <Link href={`/album/${album.slug}`} className="font-medium text-foreground hover:text-signal">
              {album.title}
            </Link>
          ) : null}
          {item.type === "followed" && item.subject ? <ProfileLink user={item.subject} /> : null}
          {(item.type === "created_list" || item.type === "liked_list") && item.list ? (
            <Link href={`/list/${item.list.id}`} className="font-medium text-foreground hover:text-signal">
              “{item.list.title}”
            </Link>
          ) : null}
          <span className="ml-2 font-mono text-xs text-muted-foreground/70" title={item.created_at}>
            <RelativeTime iso={item.created_at} />
          </span>
        </p>
        {album ? <p className="truncate text-[0.8125rem] text-muted-foreground">{album.artist_credit}</p> : null}
        {item.rating !== null && item.type !== "liked_review" ? (
          <StarRating value={Number(item.rating)} size={13} compact className="mt-1.5" />
        ) : null}
        {item.type === "reviewed" && item.review ? (
          <Link href={`/review/${item.review.id}`} className="mt-2 line-clamp-3 block text-sm leading-relaxed text-foreground/80 hover:text-foreground">
            {item.review.contains_spoilers ? (
              <span className="italic text-muted-foreground">This review contains spoilers.</span>
            ) : (
              item.review.body
            )}
          </Link>
        ) : null}
      </div>

      {album ? (
        <Link href={`/album/${album.slug}`} className="w-14 shrink-0 sm:w-16">
          <AlbumCover src={album.cover_url} title={album.title} artist={album.artist_credit} sizes="64px" />
        </Link>
      ) : null}
    </article>
  );
}
