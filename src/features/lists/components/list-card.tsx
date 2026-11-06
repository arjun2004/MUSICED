import Link from "next/link";
import { Heart } from "lucide-react";
import { UserAvatar } from "@/components/profile/user-avatar";
import { formatCount, pluralize } from "@/lib/utils/format";
import type { ListSummary } from "@/features/lists/queries";
import { ListCollage } from "./list-collage";
import { VisibilityBadge } from "./visibility-badge";

export function ListCard({ list, showOwner = true }: { list: ListSummary; showOwner?: boolean }) {
  return (
    <article className="group min-w-0">
      <Link href={`/list/${list.id}`} className="block rounded-[3px]" aria-label={list.title}>
        <ListCollage albums={list.preview} coverPath={list.cover_path} />
      </Link>
      <div className="mt-3 min-w-0">
        <h3 className="truncate text-[0.9375rem] leading-snug font-semibold tracking-tight">
          <Link href={`/list/${list.id}`} className="hover:text-signal">
            {list.title}
          </Link>
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted-foreground">
          {showOwner ? (
            <Link href={`/user/${list.owner.username}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
              <UserAvatar user={list.owner} size="xs" />
              {list.owner.display_name || list.owner.username}
            </Link>
          ) : null}
          <span className="font-mono text-xs">{pluralize(list.items_count, "album")}</span>
          {list.likes_count > 0 ? (
            <span className="inline-flex items-center gap-1 font-mono text-xs" aria-label={`${list.likes_count} likes`}>
              <Heart className="size-3" aria-hidden="true" /> {formatCount(list.likes_count)}
            </span>
          ) : null}
          <VisibilityBadge visibility={list.visibility} />
        </div>
        {list.description ? (
          <p className="mt-2 line-clamp-2 text-[0.8125rem] leading-relaxed text-muted-foreground">{list.description}</p>
        ) : null}
      </div>
    </article>
  );
}

export function ListGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
