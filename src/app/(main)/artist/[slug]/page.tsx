import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Disc3, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlbumCard, AlbumGrid } from "@/components/albums/album-card";
import { AlbumCover } from "@/components/albums/album-cover";
import { EmptyState, SectionHeader } from "@/components/shared/states";
import { formatAverage, formatPartialDate, pluralize } from "@/lib/utils/format";
import { getArtistBySlug, type ArtistDetail } from "@/features/catalog/queries";
import { getProviderDiscography } from "@/features/catalog/service";

export async function generateMetadata({ params }: PageProps<"/artist/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) return { title: "Artist not found" };
  return {
    title: artist.name,
    description: `Albums, ratings and reviews for ${artist.name} on MUSICED.`,
  };
}

export default function ArtistPage({ params }: PageProps<"/artist/[slug]">) {
  return (
    <Suspense fallback={<ArtistSkeleton />}>
      <Body params={params} />
    </Suspense>
  );
}

const TYPE: Record<string, string> = {
  person: "Artist",
  group: "Group",
  orchestra: "Orchestra",
  choir: "Choir",
  character: "Character",
  other: "Artist",
};

async function Body({ params }: Pick<PageProps<"/artist/[slug]">, "params">) {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) notFound();

  const rated = artist.albums.filter((a) => a.ratings_count > 0);
  const totalRatings = rated.reduce((n, a) => n + a.ratings_count, 0);
  const avg = totalRatings ? rated.reduce((n, a) => n + (a.average_rating ?? 0) * a.ratings_count, 0) / totalRatings : null;
  const span = [formatPartialDate(artist.begin_date), formatPartialDate(artist.end_date)].filter(Boolean).join(" – ");
  const heroCovers = artist.albums.filter((a) => a.cover_url).slice(0, 6);

  return (
    <div>
      <header className="relative overflow-hidden border-b border-hairline">
        {heroCovers.length > 0 ? (
          <div className="pointer-events-none absolute inset-0 grid grid-cols-6 opacity-20 blur-2xl" aria-hidden="true">
            {heroCovers.map((a) => (
              <div key={a.id} className="bg-cover bg-center" style={{ backgroundImage: `url(${a.cover_url})` }} />
            ))}
          </div>
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/30 to-background" aria-hidden="true" />
        <div className="relative container-page py-14 sm:py-20">
          <p className="eyebrow mb-3">
            {TYPE[artist.artist_type ?? ""] ?? "Artist"}
            {artist.country ? ` · ${artist.country}` : ""}
            {span ? ` · ${span}` : ""}
          </p>
          <h1 className="display">{artist.name}</h1>
          {artist.disambiguation ? <p className="mt-3 text-muted-foreground">{artist.disambiguation}</p> : null}
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            <Stat label="On MUSICED" value={pluralize(artist.albums.length, "album")} />
            <Stat label="Ratings" value={String(totalRatings)} />
            {avg !== null ? <Stat label="Average" value={formatAverage(avg)} /> : null}
            <Stat label="Fans" value={String(artist.fans)} />
          </dl>
          {artist.musicbrainz_id ? (
            <a
              href={`https://musicbrainz.org/artist/${artist.musicbrainz_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              MusicBrainz <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </header>

      <div className="container-page mt-12 grid gap-16">
        <section>
          <SectionHeader eyebrow="Discography" title="On MUSICED" />
          {artist.albums.length > 0 ? (
            <AlbumGrid>
              {artist.albums.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  href={`/album/${album.slug}`}
                  averageRating={album.ratings_count > 0 ? album.average_rating : undefined}
                />
              ))}
            </AlbumGrid>
          ) : (
            <EmptyState icon={Disc3} title="No albums here yet" description="Open one from the full discography below." />
          )}
        </section>

        {artist.musicbrainz_id ? (
          <Suspense fallback={<DiscographySkeleton />}>
            <MoreDiscography artist={artist} />
          </Suspense>
        ) : null}
      </div>
    </div>
  );
}

async function MoreDiscography({ artist }: { artist: ArtistDetail }) {
  let hits;
  try {
    hits = await getProviderDiscography(artist.musicbrainz_id!);
  } catch {
    return <p className="text-sm text-muted-foreground">MusicBrainz is unavailable right now, so the full discography can&apos;t be shown.</p>;
  }
  const have = new Set(artist.albums.map((a) => a.title.toLowerCase()));
  const remaining = hits.filter((h) => !have.has(h.title.toLowerCase()));
  if (remaining.length === 0) return null;

  return (
    <section>
      <SectionHeader eyebrow="From MusicBrainz" title="Full discography" />
      <AlbumGrid>
        {remaining.map((hit) => (
          <Link key={hit.externalId} href={`/album/import/${hit.externalId}`} prefetch={false} className="group block min-w-0">
            <AlbumCover src={hit.coverUrl} title={hit.title} artist={hit.artistCredit} />
            <p className="mt-2.5 truncate text-sm font-medium group-hover:text-signal">{hit.title}</p>
            <p className="truncate text-[0.8125rem] text-muted-foreground">
              {hit.releaseYear ?? "—"} · {hit.albumType === "ep" ? "EP" : "Album"}
            </p>
          </Link>
        ))}
      </AlbumGrid>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
      <dt className="eyebrow mt-0.5 !text-[0.625rem]">{label}</dt>
    </div>
  );
}

function DiscographySkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="mb-6 h-6 w-48" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    </div>
  );
}

function ArtistSkeleton() {
  return (
    <div className="container-page py-20" aria-hidden="true">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-4 h-14 w-2/3" />
      <Skeleton className="mt-8 h-10 w-80" />
    </div>
  );
}
