import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlbumCover } from "@/components/albums/album-cover";
import { StarRating } from "@/components/shared/star-rating";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import { formatAverage, pluralize } from "@/lib/utils/format";
import { browseAlbums, getExploreFacets } from "@/features/discovery/queries";
import { browseHref, parseBrowseParams } from "@/features/discovery/browse-params";
import { FilterBar } from "@/features/discovery/components/filter-bar";

export const metadata: Metadata = {
  title: "Charts",
  description: "The highest-rated albums on MUSICED, all time and by decade, year, genre and country.",
};

export default function ChartsPage({ searchParams }: PageProps<"/charts">) {
  return (
    <div className="container-page">
      <PageHeader
        eyebrow="Community charts"
        title="The charts"
        description="Ranked by a weighted average, so a handful of five-star ratings can't top a record hundreds of people love."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ searchParams }: Pick<PageProps<"/charts">, "searchParams">) {
  const parsed = parseBrowseParams(await searchParams, "top");
  const filters = { ...parsed, sort: parsed.sort === "popular" ? "popular" : "top" } as typeof parsed;
  const [facets, albums] = await Promise.all([getExploreFacets(), browseAlbums({ ...filters, pageSize: 50 })]);

  return (
    <div className="grid gap-8">
      <nav aria-label="Chart type" className="flex gap-1">
        {(["top", "popular"] as const).map((s) => (
          <Link
            key={s}
            href={browseHref("/charts", filters, { sort: s })}
            aria-current={filters.sort === s ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm",
              filters.sort === s ? "bg-foreground font-medium text-background" : "text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            {s === "top" ? "Top rated" : "Most popular"}
          </Link>
        ))}
      </nav>
      <FilterBar base="/charts" filters={filters} facets={facets} showSort={false} />

      {albums.length === 0 ? (
        <EmptyState icon={Trophy} title="No chart yet for these filters" description="Albums need ratings to chart." />
      ) : (
        <ol className="divide-y divide-hairline">
          {albums.map((album, index) => (
            <li key={album.id}>
              <Link href={`/album/${album.slug}`} className="group grid grid-cols-[2.5rem_4rem_minmax(0,1fr)_auto] items-center gap-4 py-3 sm:grid-cols-[3.5rem_5rem_minmax(0,1fr)_auto]">
                <span
                  className={cn(
                    "text-right font-mono text-xl font-semibold tabular-nums sm:text-2xl",
                    index < 3 ? "text-signal" : "text-foreground/70",
                  )}
                >
                  {index + 1}
                </span>
                <AlbumCover src={album.cover_url} title={album.title} artist={album.artist_credit} sizes="80px" priority={index < 4} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold tracking-tight group-hover:text-signal sm:text-lg">{album.title}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {album.artist_credit}
                    {album.release_year ? ` · ${album.release_year}` : ""}
                  </span>
                </span>
                <span className="text-right">
                  {album.average_rating !== null ? (
                    <>
                      <span className="block font-mono text-lg font-semibold tabular-nums">{formatAverage(album.average_rating)}</span>
                      <StarRating value={Math.round(album.average_rating * 2) / 2} size={10} compact className="justify-end" />
                    </>
                  ) : null}
                  <span className="mt-0.5 block font-mono text-[0.6875rem] text-muted-foreground">{pluralize(album.ratings_count, "rating")}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
