import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink, ListMusic, MessageSquareText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlbumCard, AlbumGrid } from "@/components/albums/album-card";
import { AlbumCover } from "@/components/albums/album-cover";
import { ReviewCard } from "@/components/reviews/review-card";
import { RatingHistogram } from "@/components/shared/rating-histogram";
import { StarRating } from "@/components/shared/star-rating";
import { EmptyState, SectionHeader } from "@/components/shared/states";
import { getViewer } from "@/lib/auth/session";
import { formatAverage, formatCount, formatDuration, formatPartialDate, pluralize } from "@/lib/utils/format";
import { getAlbumBySlug, getAlbumReviews, getAlbumStats, getRelatedAlbums, type AlbumDetail } from "@/features/catalog/queries";
import { getListsWithAlbum } from "@/features/lists/queries";
import { ListCard } from "@/features/lists/components/list-card";
import { AddToListDialog } from "@/features/lists/components/add-to-list-dialog";
import { ShareButton } from "@/features/lists/components/list-actions";
import { getViewerAlbumState } from "@/features/listening/queries";
import { AlbumActions } from "@/features/listening/components/album-actions";

const TYPE_LABELS: Record<string, string> = {
  album: "Album",
  ep: "EP",
  single: "Single",
  compilation: "Compilation",
  live: "Live album",
  soundtrack: "Soundtrack",
  remix: "Remix album",
  mixtape: "Mixtape",
  broadcast: "Broadcast",
  other: "Release",
};

export async function generateMetadata({ params }: PageProps<"/album/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const album = await getAlbumBySlug(slug);
  if (!album) return { title: "Album not found" };
  const title = `${album.title} by ${album.artist_credit}`;
  return {
    title,
    description: `Ratings, reviews and lists for ${title}${album.release_year ? ` (${album.release_year})` : ""} on MUSICED.`,
    openGraph: { title, images: album.cover_url ? [{ url: album.cover_url }] : undefined },
  };
}

export default function AlbumPage({ params }: PageProps<"/album/[slug]">) {
  return (
    <Suspense fallback={<AlbumSkeleton />}>
      <AlbumBody params={params} />
    </Suspense>
  );
}

async function AlbumBody({ params }: Pick<PageProps<"/album/[slug]">, "params">) {
  const { slug } = await params;
  const album = await getAlbumBySlug(slug);
  if (!album) notFound();

  const [stats, viewer] = await Promise.all([getAlbumStats(album.id), getViewer()]);
  const released = formatPartialDate(album.release_date);
  const discs = new Set(album.tracks.map((t) => t.disc_number)).size;

  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicAlbum",
    name: album.title,
    url: `${site}/album/${album.slug}`,
    image: album.cover_url ?? undefined,
    datePublished: album.release_date ?? undefined,
    numTracks: album.track_count ?? undefined,
    genre: album.genres.slice(0, 5).map((g) => g.name),
    recordLabel: album.label ? { "@type": "Organization", name: album.label } : undefined,
    byArtist: album.artists.map((a) => ({ "@type": "MusicGroup", name: a.name, url: `${site}/artist/${a.slug}` })),
    track: album.tracks.slice(0, 100).map((t) => ({
      "@type": "MusicRecording",
      name: t.title,
      position: t.position,
      duration: t.duration_ms ? `PT${Math.floor(t.duration_ms / 60000)}M${Math.round((t.duration_ms % 60000) / 1000)}S` : undefined,
    })),
    aggregateRating:
      stats.ratings_count > 0 && stats.average_rating !== null
        ? { "@type": "AggregateRating", ratingValue: stats.average_rating, ratingCount: stats.ratings_count, bestRating: 5, worstRating: 0.5 }
        : undefined,
  };

  return (
    <article>
      <script
        type="application/ld+json"
        // JSON-LD for search engines. "<" is escaped so user-controlled text can't close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {/* Blurred artwork wash behind the header */}
      <div className="relative overflow-hidden border-b border-hairline">
        {album.cover_url ? (
          <div
            className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-25 blur-3xl"
            style={{ backgroundImage: `url(${album.cover_url})` }}
            aria-hidden="true"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/40 to-background" aria-hidden="true" />

        <div className="relative container-page grid gap-8 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-12">
          {/* Cover + title share a row so the title anchors to the cover's bottom edge. */}
          <div className="grid min-w-0 gap-8 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] sm:items-end lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[300px] sm:mx-0">
            <AlbumCover src={album.cover_url} title={album.title} artist={album.artist_credit} sizes="300px" priority />
          </div>

          <header className="min-w-0">
            <p className="eyebrow mb-3">
              {TYPE_LABELS[album.album_type] ?? "Release"}
              {album.release_year ? ` · ${album.release_year}` : ""}
            </p>
            <h1 className="display !text-4xl sm:!text-5xl">{album.title}</h1>
            <p className="mt-3 text-lg text-foreground/90">
              <Credits album={album} />
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:flex sm:flex-wrap">
              {released ? <Meta label="Released" value={released} /> : null}
              {album.label ? <Meta label="Label" value={album.label} /> : null}
              {album.track_count ? (
                <Meta
                  label="Length"
                  value={`${pluralize(album.track_count, "track")}${album.duration_ms ? ` · ${formatDuration(album.duration_ms)}` : ""}`}
                />
              ) : null}
            </dl>
            {album.genres.length > 0 ? (
              <ul className="mt-6 flex flex-wrap gap-1.5" aria-label="Genres">
                {album.genres.map((genre) => (
                  <li key={genre.slug} className="rounded-full border border-border bg-background/40 px-2.5 py-1 text-xs text-foreground/85">
                    {genre.name}
                  </li>
                ))}
              </ul>
            ) : null}
          </header>

          </div>

          <aside className="grid content-start gap-5">
            <div className="rounded-md border border-border bg-background/60 p-4 backdrop-blur-sm">
              <p className="eyebrow mb-2">Community rating</p>
              {stats.ratings_count > 0 && stats.average_rating !== null ? (
                <>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-semibold tracking-tight tabular-nums">{formatAverage(stats.average_rating)}</span>
                    <StarRating value={Math.round(stats.average_rating * 2) / 2} size={14} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{pluralize(stats.ratings_count, "rating")}</p>
                  <RatingHistogram buckets={stats.rating_histogram} className="mt-4" height={44} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No ratings yet.</p>
              )}
              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-hairline pt-3 text-center">
                <Stat label="Logs" value={stats.logs_count} />
                <Stat label="Reviews" value={stats.reviews_count} />
                <Stat label="Favs" value={stats.favorites_count} />
              </dl>
            </div>
            <Suspense fallback={<Skeleton className="h-40" />}>
              <ViewerActions albumId={album.id} albumTitle={album.title} albumPath={`/album/${album.slug}`} />
            </Suspense>
            <div className="grid gap-2">
              <AddToListDialog albumId={album.id} albumTitle={album.title} isSignedIn={Boolean(viewer)} />
              <ShareButton path={`/album/${album.slug}`} title={`${album.title} by ${album.artist_credit}`} />
            </div>
          </aside>
        </div>
      </div>

      <div className="container-page mt-12 grid gap-14 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div className="grid content-start gap-14">
          <section aria-labelledby="reviews">
            <Suspense fallback={<Skeleton className="h-48" />}>
              <Reviews albumId={album.id} />
            </Suspense>
          </section>
          <Suspense fallback={null}>
            <Related album={album} />
          </Suspense>
        </div>

        <aside className="grid content-start gap-12">
          <section aria-labelledby="tracklist">
            <SectionHeader title="Tracklist" />
            {album.tracks.length > 0 ? (
              <ol className="text-sm">
                {album.tracks.map((track, i) => {
                  const newDisc = discs > 1 && (i === 0 || album.tracks[i - 1].disc_number !== track.disc_number);
                  return (
                    <li key={track.id}>
                      {newDisc ? <p className="eyebrow mt-4 mb-1 first:mt-0">Disc {track.disc_number}</p> : null}
                      <div className="flex items-baseline gap-3 border-b border-hairline py-2">
                        <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
                          {track.number ?? track.position}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{track.title}</span>
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          {formatDuration(track.duration_ms) ?? "—"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No tracklist available for this release.</p>
            )}
          </section>

          <section aria-labelledby="in-lists">
            <Suspense fallback={<Skeleton className="h-40" />}>
              <InLists albumId={album.id} />
            </Suspense>
          </section>

          {album.musicbrainz_url ? (
            <a
              href={album.musicbrainz_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Data from MusicBrainz <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ) : null}
        </aside>
      </div>
    </article>
  );
}

async function ViewerActions({ albumId, albumTitle, albumPath }: { albumId: string; albumTitle: string; albumPath: string }) {
  const state = await getViewerAlbumState(albumId);
  return <AlbumActions albumId={albumId} albumTitle={albumTitle} albumPath={albumPath} state={state} />;
}

function Credits({ album }: { album: AlbumDetail }) {
  if (album.artists.length === 0) return <>{album.artist_credit}</>;
  return (
    <>
      {album.artists.map((artist) => (
        <span key={artist.id}>
          <Link href={`/artist/${artist.slug}`} className="font-medium hover:text-signal">
            {artist.credited_name || artist.name}
          </Link>
          {artist.join_phrase}
        </span>
      ))}
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow !text-[0.625rem]">{label}</dt>
      <dd className="mt-0.5 text-foreground/90">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dd className="text-sm font-semibold tabular-nums">{formatCount(value)}</dd>
      <dt className="eyebrow !text-[0.5625rem]">{label}</dt>
    </div>
  );
}

async function Reviews({ albumId }: { albumId: string }) {
  const reviews = await getAlbumReviews(albumId, 6);
  return (
    <>
      <SectionHeader eyebrow="From the community" title="Reviews" />
      {reviews.length > 0 ? (
        <div className="divide-y divide-hairline">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      ) : (
        <EmptyState icon={MessageSquareText} title="No reviews yet" description="Reviews of this album will appear here." />
      )}
    </>
  );
}

async function InLists({ albumId }: { albumId: string }) {
  const lists = await getListsWithAlbum(albumId, 3);
  return (
    <>
      <SectionHeader title="In lists" />
      {lists.length > 0 ? (
        <div className="grid gap-8">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListMusic className="size-4" aria-hidden="true" /> Not in any public lists yet.
        </p>
      )}
    </>
  );
}

async function Related({ album }: { album: AlbumDetail }) {
  const related = await getRelatedAlbums(album.id, album.genres.map((g) => g.slug), 6);
  if (related.length === 0) return null;
  return (
    <section aria-labelledby="related">
      <SectionHeader eyebrow="Shares genres" title="Related albums" />
      <AlbumGrid className="lg:grid-cols-3 xl:grid-cols-6">
        {related.map((a) => (
          <AlbumCard key={a.id} album={a} href={`/album/${a.slug}`} />
        ))}
      </AlbumGrid>
    </section>
  );
}

function AlbumSkeleton() {
  return (
    <div className="container-page grid gap-8 py-14 sm:grid-cols-[260px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)_260px]" aria-hidden="true">
      <Skeleton className="aspect-square w-full" />
      <div className="space-y-4 self-end">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-10 w-2/3" />
      </div>
      <Skeleton className="h-60" />
    </div>
  );
}

