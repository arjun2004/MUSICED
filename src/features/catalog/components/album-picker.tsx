"use client";

import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AlbumCover } from "@/components/albums/album-cover";
import { cn } from "@/lib/utils";
import type { AlbumSummary } from "@/types/domain";
import type { ProviderAlbumHit } from "@/lib/music-providers/types";
import { searchAlbumsAction } from "@/features/catalog/actions";

export type PickedAlbum =
  | { kind: "local"; album: AlbumSummary }
  | { kind: "remote"; hit: ProviderAlbumHit };

function useDebounced(value: string, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/**
 * Album search for pickers. Albums already on MUSICED come first; MusicBrainz
 * matches follow and are imported when chosen (handled by `onPick`).
 */
export function AlbumPicker({
  onPick,
  isAdded,
  busyKey,
  placeholder = "Search albums or artists",
  autoFocus,
}: {
  onPick: (picked: PickedAlbum) => void;
  /** Return true for albums already chosen (local id or external id). */
  isAdded?: (key: string) => boolean;
  /** Key currently being processed (shows a spinner). */
  busyKey?: string | null;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim());
  const listId = useId();

  const { data, isFetching, error } = useQuery({
    queryKey: ["album-search", q],
    queryFn: async () => {
      const result = await searchAlbumsAction(q);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: q.length >= 2,
    staleTime: 5 * 60_000,
  });

  const rows: { key: string; title: string; artist: string; year: number | null; cover: string | null; picked: PickedAlbum; source: "local" | "remote" }[] = [
    ...(data?.local ?? []).map((album) => ({
      key: album.id,
      title: album.title,
      artist: album.artist_credit,
      year: album.release_year,
      cover: album.cover_url,
      picked: { kind: "local", album } as PickedAlbum,
      source: "local" as const,
    })),
    ...(data?.remote ?? []).map((hit) => ({
      key: hit.externalId,
      title: hit.title,
      artist: hit.artistCredit,
      year: hit.releaseYear,
      cover: hit.coverUrl,
      picked: { kind: "remote", hit } as PickedAlbum,
      source: "remote" as const,
    })),
  ];
  const firstRemote = rows.findIndex((r) => r.source === "remote");

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Search albums"
          aria-controls={listId}
          autoFocus={autoFocus}
          maxLength={120}
          className="h-10 pl-9"
        />
        {isFetching ? (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : null}
      </div>

      <div id={listId} role="list" aria-live="polite" className="mt-2">
        {error ? <p className="py-3 text-sm text-destructive">{(error as Error).message}</p> : null}
        {data?.remoteError ? <p className="py-2 text-xs text-muted-foreground">{data.remoteError}</p> : null}
        {q.length >= 2 && data && rows.length === 0 && !isFetching ? (
          <p className="py-4 text-sm text-muted-foreground">No albums match “{q}”.</p>
        ) : null}
        {rows.map((row, i) => {
          const added = isAdded?.(row.key) ?? false;
          const busy = busyKey === row.key;
          return (
            <div key={`${row.source}-${row.key}`} role="listitem">
              {i === firstRemote ? (
                <p className="eyebrow mt-3 mb-1 border-t border-hairline pt-3">More from MusicBrainz</p>
              ) : null}
              <button
                type="button"
                disabled={added || busy}
                onClick={() => onPick(row.picked)}
                aria-label={added ? `${row.title} by ${row.artist} (already added)` : `Add ${row.title} by ${row.artist}`}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
                  "hover:bg-surface focus-visible:bg-surface disabled:cursor-default disabled:hover:bg-transparent",
                )}
              >
                <div className="w-10 shrink-0">
                  <AlbumCover src={row.cover} title={row.title} artist={row.artist} sizes="40px" />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{row.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {row.artist}
                    {row.year ? ` · ${row.year}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-muted-foreground" aria-hidden="true">
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : added ? (
                    <Check className="size-4 text-signal" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
