import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListMusic, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlbumCover } from "@/components/albums/album-cover";
import { UserAvatar } from "@/components/profile/user-avatar";
import { EmptyState } from "@/components/shared/states";
import { formatMonthYear, pluralize } from "@/lib/utils/format";
import { getList } from "@/features/lists/queries";
import { ListCollage } from "@/features/lists/components/list-collage";
import { ListLikeButton, ShareButton } from "@/features/lists/components/list-actions";
import { VisibilityBadge } from "@/features/lists/components/visibility-badge";
import { RelativeTime } from "@/components/shared/relative-time";

export async function generateMetadata({ params }: PageProps<"/list/[id]">): Promise<Metadata> {
  const { id } = await params;
  const list = await getList(id);
  if (!list) return { title: "List not found" };
  const owner = list.owner.display_name || list.owner.username;
  return {
    title: `${list.title} — a list by ${owner}`,
    description: list.description || `${pluralize(list.items_count, "album")} curated by ${owner} on MUSICED.`,
    robots: list.visibility === "public" ? undefined : { index: false },
  };
}

export default function ListPage({ params }: PageProps<"/list/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Pick<PageProps<"/list/[id]">, "params">) {
  const { id } = await params;
  const list = await getList(id);
  if (!list) notFound();
  const owner = list.owner.display_name || list.owner.username;

  return (
    <div className="container-page">
      <header className="grid gap-8 border-b border-hairline py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)] md:items-end md:py-14">
        <div className="min-w-0">
          <p className="eyebrow mb-3 flex flex-wrap items-center gap-2">
            {list.is_ranked ? "Ranked list" : "List"} · {pluralize(list.items_count, "album")}
            <VisibilityBadge visibility={list.visibility} />
          </p>
          <h1 className="display !text-4xl sm:!text-5xl">{list.title}</h1>
          <Link href={`/user/${list.owner.username}`} className="group mt-5 inline-flex items-center gap-2 text-sm">
            <UserAvatar user={list.owner} size="sm" />
            <span>
              <span className="text-muted-foreground">by </span>
              <span className="font-medium group-hover:text-signal">{owner}</span>
            </span>
          </Link>
          {list.description ? (
            <p className="mt-5 max-w-2xl text-[0.9375rem] leading-relaxed whitespace-pre-line text-foreground/85">
              {list.description}
            </p>
          ) : null}
          <div className="mt-7 flex flex-wrap items-center gap-2">
            <ListLikeButton
              listId={list.id}
              initialLiked={list.viewerLiked}
              initialCount={list.likes_count}
              isSignedIn={list.isSignedIn}
              disabled={list.isOwner}
            />
            <ShareButton path={`/list/${list.id}`} title={list.title} />
            {list.isOwner ? (
              <Button asChild size="sm" className="font-semibold">
                <Link href={`/list/${list.id}/edit`}>
                  <Pencil data-icon="inline-start" /> Edit list
                </Link>
              </Button>
            ) : null}
          </div>
          <p className="mt-5 font-mono text-xs text-muted-foreground">
            Created {formatMonthYear(list.created_at)} · updated <RelativeTime iso={list.updated_at} suffix=" ago" />
          </p>
        </div>
        <ListCollage albums={list.items.slice(0, 5).map((i) => i.album)} coverPath={list.cover_path} size="lg" className="hidden md:block" />
      </header>

      <div className="py-10">
        {list.items.length === 0 ? (
          <EmptyState
            icon={ListMusic}
            title="This list is empty"
            description={list.isOwner ? "Add albums to bring it to life." : undefined}
            action={list.isOwner ? { label: "Add albums", href: `/list/${list.id}/edit` } : undefined}
          />
        ) : list.is_ranked ? (
          <ol className="divide-y divide-hairline">
            {list.items.map((item, index) => (
              <li key={item.id} className="grid grid-cols-[2.5rem_5rem_minmax(0,1fr)] items-start gap-4 py-5 sm:grid-cols-[3.5rem_7rem_minmax(0,1fr)]">
                <span className="pt-1 text-right font-mono text-2xl font-semibold tracking-tight text-foreground/90 tabular-nums sm:text-3xl">
                  {index + 1}
                </span>
                <Link href={`/album/${item.album.slug}`}>
                  <AlbumCover src={item.album.cover_url} title={item.album.title} artist={item.album.artist_credit} sizes="112px" />
                </Link>
                <div className="min-w-0 pt-1">
                  <Link href={`/album/${item.album.slug}`} className="hover:text-signal">
                    <h2 className="text-lg font-semibold tracking-tight">{item.album.title}</h2>
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {item.album.artist_credit}
                    {item.album.release_year ? ` · ${item.album.release_year}` : ""}
                  </p>
                  {item.note ? (
                    <p className="mt-3 max-w-xl border-l-2 border-signal/50 pl-3 text-sm leading-relaxed text-foreground/85">
                      {item.note}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
            {list.items.map((item) => (
              <li key={item.id} className="min-w-0">
                <Link href={`/album/${item.album.slug}`} className="group block">
                  <AlbumCover src={item.album.cover_url} title={item.album.title} artist={item.album.artist_credit} />
                  <p className="mt-2.5 truncate text-sm font-medium group-hover:text-signal">{item.album.title}</p>
                  <p className="truncate text-[0.8125rem] text-muted-foreground">{item.album.artist_credit}</p>
                </Link>
                {item.note ? <p className="mt-1.5 line-clamp-3 text-xs text-muted-foreground italic">“{item.note}”</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="container-page py-14" aria-hidden="true">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-4 h-12 w-2/3" />
      <Skeleton className="mt-5 h-8 w-48" />
      <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    </div>
  );
}
