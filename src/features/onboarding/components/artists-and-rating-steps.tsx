"use client";

import { useEffect, useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Mic2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlbumCover } from "@/components/albums/album-cover";
import { StarRatingInput } from "@/components/shared/star-rating-input";
import type { AlbumWithStats } from "@/types/domain";
import { setRating } from "@/features/listening/actions";
import {
  getOnboardingAlbums,
  saveFavoriteArtists,
  searchArtistsAction,
  type ArtistPick,
} from "@/features/onboarding/actions";

function useDebounced(value: string, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const keyOf = (p: ArtistPick) => (p.kind === "local" ? `l:${p.id}` : `r:${p.externalId}`);

/** Pick up to 12 favourite artists from MUSICED or MusicBrainz. */
export function ArtistsStep({
  initial,
  renderNav,
}: {
  initial: { id: string; name: string }[];
  renderNav: (args: { save: (then: () => void) => void; pending: boolean; count: number }) => React.ReactNode;
}) {
  const [picks, setPicks] = useState<ArtistPick[]>(initial.map((a) => ({ kind: "local", id: a.id, name: a.name })));
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim());
  const [pending, startTransition] = useTransition();

  const { data, isFetching } = useQuery({
    queryKey: ["onboarding-artists", q],
    queryFn: async () => {
      const result = await searchArtistsAction(q);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: q.length >= 2,
    staleTime: 5 * 60_000,
  });

  const chosen = new Set(picks.map(keyOf));

  function toggle(pick: ArtistPick) {
    const k = keyOf(pick);
    setPicks((current) => {
      if (current.some((p) => keyOf(p) === k)) return current.filter((p) => keyOf(p) !== k);
      if (current.length >= 12) {
        toast.message("You can pick up to 12 artists.");
        return current;
      }
      return [...current, pick];
    });
  }

  function save(then: () => void) {
    startTransition(async () => {
      const result = await saveFavoriteArtists(picks);
      if (result.ok) then();
      else toast.error(result.error);
    });
  }

  const results: { pick: ArtistPick; meta: string }[] = [
    ...(data?.local ?? []).map((a) => ({
      pick: { kind: "local" as const, id: a.id, name: a.name },
      meta: [a.disambiguation, a.country].filter(Boolean).join(" · "),
    })),
    ...(data?.remote ?? []).map((a) => ({
      pick: { kind: "remote" as const, externalId: a.externalId, name: a.name },
      meta: [a.disambiguation, a.country].filter(Boolean).join(" · "),
    })),
  ];

  return (
    <div>
      {picks.length > 0 ? (
        <ul className="mb-5 flex flex-wrap gap-2" aria-label="Chosen artists">
          {picks.map((p) => (
            <li key={keyOf(p)}>
              <button
                type="button"
                onClick={() => toggle(p)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-signal px-3 text-sm font-medium text-signal-foreground"
                aria-label={`Remove ${p.name}`}
              >
                {p.name} <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artists"
          aria-label="Search artists"
          className="h-10 pl-9"
          autoFocus
        />
        {isFetching ? (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : null}
      </div>

      <ul className="mt-2 max-h-64 overflow-y-auto" aria-live="polite">
        {results.map(({ pick, meta }) => {
          const k = keyOf(pick);
          const on = chosen.has(k);
          return (
            <li key={k}>
              <button
                type="button"
                onClick={() => toggle(pick)}
                aria-pressed={on}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-surface"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-surface-raised text-muted-foreground">
                  <Mic2 className="size-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{pick.name}</span>
                  {meta ? <span className="block truncate text-xs text-muted-foreground">{meta}</span> : null}
                </span>
                {on ? (
                  <Check className="size-4 text-signal" aria-hidden="true" />
                ) : (
                  <Plus className="size-4 text-muted-foreground" aria-hidden="true" />
                )}
              </button>
            </li>
          );
        })}
        {q.length >= 2 && data && results.length === 0 ? (
          <li className="px-2 py-3 text-sm text-muted-foreground">No artists match “{q}”.</li>
        ) : null}
      </ul>

      {renderNav({ save, pending, count: picks.length })}
    </div>
  );
}

/** Rate a few well-known albums in the viewer's genres. Ratings save on tap. */
export function RateStep({ nav }: { nav: React.ReactNode }) {
  const [albums, setAlbums] = useState<AlbumWithStats[] | null>(null);
  const [ratings, setRatings] = useState<Record<string, number | null>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOnboardingAlbums().then((result) => {
      if (cancelled) return;
      if (result.ok) setAlbums(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function rate(albumId: string, value: number | null) {
    const previous = ratings[albumId] ?? null;
    setRatings((r) => ({ ...r, [albumId]: value }));
    const result = await setRating(albumId, value);
    if (!result.ok) {
      setRatings((r) => ({ ...r, [albumId]: previous }));
      toast.error(result.error);
    }
  }

  const rated = Object.values(ratings).filter((v) => v !== null).length;

  return (
    <div>
      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
        {albums === null && !error
          ? Array.from({ length: 6 }, (_, i) => (
              <li key={i}>
                <Skeleton className="aspect-square" />
                <Skeleton className="mt-2 h-4 w-3/4" />
              </li>
            ))
          : null}
        {albums?.map((album) => (
          <li key={album.id} className="min-w-0">
            <AlbumCover src={album.cover_url} title={album.title} artist={album.artist_credit} sizes="160px" />
            <p className="mt-2 truncate text-sm font-medium">{album.title}</p>
            <p className="truncate text-xs text-muted-foreground">{album.artist_credit}</p>
            <StarRatingInput
              value={ratings[album.id] ?? null}
              onChange={(v) => rate(album.id, v)}
              size={18}
              showLabel={false}
              aria-label={`Rate ${album.title}`}
              className="mt-1.5 gap-1"
            />
          </li>
        ))}
      </ul>
      {albums && albums.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          There aren&apos;t enough albums to suggest yet. You can rate albums from any album page.
        </p>
      ) : null}
      <p className="mt-4 font-mono text-xs text-muted-foreground tabular-nums">
        {rated} rated{rated < 3 ? " · rate a few you know, skip the rest" : ""}
      </p>
      {nav}
    </div>
  );
}
