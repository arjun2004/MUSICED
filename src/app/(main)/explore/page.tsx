import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Compass, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlbumCard, AlbumGrid } from "@/components/albums/album-card";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { browseAlbums, getExploreFacets } from "@/features/discovery/queries";
import { browseHref, parseBrowseParams } from "@/features/discovery/browse-params";
import { FilterBar } from "@/features/discovery/components/filter-bar";

export const metadata: Metadata = {
  title: "Explore",
  description: "Browse albums by genre, decade, year and country — top rated, trending, new and popular on MUSICED.",
};

const PAGE_SIZE = 36;

export default function ExplorePage({ searchParams }: PageProps<"/explore">) {
  return (
    <div className="container-page">
      <PageHeader
        eyebrow="Discovery"
        title="Explore"
        description="Dig through the catalog by genre, era and place. Everything here is ranked by the community."
        actions={
          <Button asChild variant="secondary">
            <Link href="/search">
              <Search data-icon="inline-start" /> Search
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<ExploreSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ searchParams }: Pick<PageProps<"/explore">, "searchParams">) {
  const filters = parseBrowseParams(await searchParams, "top");
  const [facets, albums] = await Promise.all([
    getExploreFacets(),
    browseAlbums({ ...filters, pageSize: PAGE_SIZE }),
  ]);

  return (
    <div className="grid gap-10">
      <FilterBar base="/explore" filters={filters} facets={facets} />
      {albums.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="Nothing matches these filters yet"
          description={
            filters.sort === "trending"
              ? "Nothing has had activity in the last week. Try Top rated or Recently added."
              : "Try removing a filter, or search MusicBrainz for more albums."
          }
          action={{ label: "Search albums", href: "/search" }}
        />
      ) : (
        <>
          <AlbumGrid>
            {albums.map((album, i) => (
              <AlbumCard
                key={album.id}
                album={album}
                href={`/album/${album.slug}`}
                averageRating={album.ratings_count > 0 ? album.average_rating : undefined}
                priority={i < 6}
              />
            ))}
          </AlbumGrid>
          <nav aria-label="Pagination" className="flex items-center justify-between">
            <Button asChild variant="secondary" size="sm" className={filters.page <= 1 ? "pointer-events-none opacity-40" : ""}>
              <Link href={browseHref("/explore", filters, { page: filters.page - 1 })}>Previous</Link>
            </Button>
            <span className="font-mono text-xs text-muted-foreground">Page {filters.page}</span>
            <Button
              asChild
              variant="secondary"
              size="sm"
              className={albums.length < PAGE_SIZE ? "pointer-events-none opacity-40" : ""}
            >
              <Link href={browseHref("/explore", filters, { page: filters.page + 1 })}>Next</Link>
            </Button>
          </nav>
        </>
      )}
    </div>
  );
}

function ExploreSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="mb-4 h-8 w-96" />
      <Skeleton className="mb-10 h-8 w-72" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    </div>
  );
}
