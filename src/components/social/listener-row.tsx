import Link from "next/link";
import { UserAvatar } from "@/components/profile/user-avatar";
import { FollowButton } from "@/components/social/follow-button";
import { pluralize } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export type ListenerRowData = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_path: string | null;
  bio: string | null;
  followers_count: number;
};

export function ListenerRow({
  person,
  viewerId,
  isFollowing,
  className,
}: {
  person: ListenerRowData;
  viewerId: string | null;
  isFollowing: boolean;
  className?: string;
}) {
  const name = person.display_name || person.username;
  return (
    <div className={cn("flex items-center gap-3 py-3", className)}>
      <Link href={`/user/${person.username}`} className="shrink-0 rounded-full">
        <UserAvatar user={person} size="md" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/user/${person.username}`} className="group block min-w-0">
          <p className="truncate text-sm font-medium group-hover:text-signal">{name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            @{person.username} · {pluralize(person.followers_count, "follower")}
          </p>
        </Link>
        {person.bio ? (
          <p className="mt-1 line-clamp-1 text-[0.8125rem] text-muted-foreground">{person.bio}</p>
        ) : null}
      </div>
      {viewerId !== person.id ? (
        <FollowButton userId={person.id} initialFollowing={isFollowing} isSignedIn={Boolean(viewerId)} />
      ) : null}
    </div>
  );
}
