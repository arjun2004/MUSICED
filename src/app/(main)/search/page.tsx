import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Disc3, SearchX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlbumCard, AlbumGrid } from "@/components/albums/album-card";
import { AlbumCover } from "@/components/albums/album-cover";
import { EmptyState, PageHeader, SectionHeader } from "@/components/shared/states";
import { FormAlert } from "@/components/shared/form-field";
import { searchArtistsCatalog, searchCatalog } from "@/features/catalog/service";
import { cn } from "@/lib/utils";
import { Mic2 } from "lucide-react";
import { MemberSearch } from "@/features/social/components/member-search";

export const metadata: Metadata = {
  title: "Search",
  description: "Search albums and artists from MusicBrainz and the MUSICED community.",
};

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="container-page">
      <PageHeader
        eyebrow="Catalog"
        title="Search"
        description="Results already on MUSICED come first. Anything else is fetched from MusicBrainz."
        actions={
          <Suspense fallback={<div className="h-9 w-72" />}>
            <MemberSearch placeholder="Album or artist" label="Search albums and artists" />
          </Suspense>
        }
      />
      <Suspense fallback={null}>
        <Tabs searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Tabs({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 120) : "";
  const type = params.type === "artists" ? "artists" : "albums";
  const href = (t: string) => `/search?${new URLSearchParams({ ...(q ? { q } : {}), ...(t === "artists" ? { type: t } : {}) })}`;
  return (
    <nav aria-label="Search type" className="-mt-2 mb-8 flex gap-6 border-b border-hairline">
      {(["albums", "artists"] as const).map((t) => (
        <Link
          key={t}
          href={href(t)}
          aria-current={type === t ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 py-2.5 text-sm font-medium capitalize",
            type === t ? "border-signal text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t}
        </Link>
      ))}
    </nav>
  );
}

async function ArtistResults({ q }: { q: string }) {
  const { local, remote, remoteError } = await searchArtistsCatalog(q, 12);
  if (local.length === 0 && remote.length === 0) {
    return remoteError ? (
      <p className="text-sm text-muted-foreground">{remoteError}</p>
    ) : (
      <EmptyState icon={SearchX} title={`No artists match “${q}”`} />
    );
  }
  const rows = [
    ...local.map((a) => ({ key: a.id, href: `/artist/${a.slug}`, name: a.name, meta: [a.disambiguation, a.country].filter(Boolean).join(" · "), onSite: true })),
    ...remote.map((a) => ({ key: a.externalId, href: `/artist/import/${a.externalId}`, name: a.name, meta: [a.disambiguation, a.country].filter(Boolean).join(" · "), onSite: false })),
  ];
  return (
    <ul className="grid gap-x-10 sm:grid-cols-2">
      {rows.map((row) => (
        <li key={row.key} className="border-b border-hairline">
          <Link href={row.href} prefetch={row.onSite ? undefined : false} className="group flex items-center gap-3 py-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-surface text-muted-foreground">
              <Mic2 className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium group-hover:text-signal">{row.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{row.meta || "Artist"}</span>
            </span>
            {!row.onSite ? <span className="eyebrow !text-[0.5625rem]">MusicBrainz</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 120) : "";
  const error = typeof params.error === "string" ? params.error.slice(0, 200) : null;
  if (params.type === "artists" && q.trim().length >= 2) {
    return (
      <>
        {error ? <div className="mb-6"><FormAlert>{error}</FormAlert></div> : null}
        <ArtistResults q={q} />
      </>
    );
  }

  if (q.trim().length < 2) {
    return (
      <>
        {error ? <div className="mb-6"><FormAlert>{error}</FormAlert></div> : null}
        <EmptyState icon={Disc3} title="Find any album" description="Search by album title, artist, or both — e.g. “radiohead in rainbows”." />
      </>
    );
  }

  const { local, remote, remoteError } = await searchCatalog(q, { limit: 18 });

  return (
    <div className="grid gap-14">
      {error ? <FormAlert>{error}</FormAlert> : null}
      {local.length > 0 ? (
        <section aria-labelledby="on-musiced">
          <SectionHeader eyebrow="On MUSICED" title={`Results for “${q}”`} />
          <AlbumGrid>
            {local.map((album) => (
              <AlbumCard key={album.id} album={album} href={`/album/${album.slug}`} />
            ))}
          </AlbumGrid>
        </section>
      ) : null}

      {remote.length > 0 ? (
        <section aria-labelledby="from-musicbrainz">
          <SectionHeader eyebrow="From MusicBrainz" title={local.length ? "More matches" : `Results for “${q}”`} />
          <AlbumGrid>
            {remote.map((hit) => (
              <Link key={hit.externalId} href={`/album/import/${hit.externalId}`} prefetch={false} className="group block min-w-0">
                <AlbumCover src={hit.coverUrl} title={hit.title} artist={hit.artistCredit} />
                <p className="mt-2.5 truncate text-sm font-medium group-hover:text-signal">{hit.title}</p>
                <p className="truncate text-[0.8125rem] text-muted-foreground">
                  {hit.artistCredit}
                  {hit.releaseYear ? <span className="text-muted-foreground/60"> · {hit.releaseYear}</span> : null}
                </p>
                <p className="eyebrow mt-1 !text-[0.5625rem]">{hit.albumType}</p>
              </Link>
            ))}
          </AlbumGrid>
        </section>
      ) : null}

      {remoteError ? <p className="text-sm text-muted-foreground">{remoteError}</p> : null}

      {local.length === 0 && remote.length === 0 && !remoteError ? (
        <EmptyState icon={SearchX} title={`No albums match “${q}”`} description="Check the spelling, or try the artist's name." />
      ) : null}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <AlbumGrid>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} aria-hidden="true">
          <Skeleton className="aspect-square" />
          <Skeleton className="mt-2.5 h-4 w-3/4" />
          <Skeleton className="mt-1.5 h-3 w-1/2" />
        </div>
      ))}
    </AlbumGrid>
  );
}
