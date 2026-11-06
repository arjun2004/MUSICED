"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Pin, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlbumCover } from "@/components/albums/album-cover";
import { cn } from "@/lib/utils";
import type { AlbumSummary } from "@/types/domain";
import { setFavoriteShowcase } from "@/features/listening/actions";

/** Choose and order the four albums pinned to the profile, from the viewer's favourites. */
export function ShowcaseEditor({ favorites }: { favorites: { position: number | null; album: AlbumSummary }[] }) {
  const [pinned, setPinned] = useState<AlbumSummary[]>(
    favorites.filter((f) => f.position !== null).sort((a, b) => a.position! - b.position!).map((f) => f.album),
  );
  const [pending, startTransition] = useTransition();
  const pinnedIds = new Set(pinned.map((a) => a.id));

  function toggle(album: AlbumSummary) {
    if (pinnedIds.has(album.id)) setPinned(pinned.filter((a) => a.id !== album.id));
    else if (pinned.length < 4) setPinned([...pinned, album]);
    else toast.message("Four albums max. Unpin one first.");
  }

  function shift(index: number, by: -1 | 1) {
    const to = index + by;
    if (to < 0 || to >= pinned.length) return;
    const next = [...pinned];
    [next[index], next[to]] = [next[to], next[index]];
    setPinned(next);
  }

  function save() {
    startTransition(async () => {
      const result = await setFavoriteShowcase(pinned.map((a) => a.id));
      if (result.ok) toast.success(result.message ?? "Saved.");
      else toast.error(result.error);
    });
  }

  if (favorites.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You haven&apos;t favourited any albums yet. Press <span className="text-foreground">Favourite</span> on an{" "}
        <Link href="/explore" className="text-foreground underline-offset-2 hover:underline">album page</Link> first.
      </p>
    );
  }

  return (
    <div className="grid gap-8">
      <div>
        <p className="eyebrow mb-3">Pinned to your profile · {pinned.length}/4</p>
        <ol className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => {
            const album = pinned[i];
            return (
              <li key={i} className="min-w-0">
                {album ? (
                  <>
                    <AlbumCover src={album.cover_url} title={album.title} artist={album.artist_credit} sizes="160px" />
                    <p className="mt-2 truncate text-sm font-medium">{album.title}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={`Move ${album.title} left`} disabled={i === 0} onClick={() => shift(i, -1)}>
                        <ArrowLeft />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Move ${album.title} right`} disabled={i === pinned.length - 1} onClick={() => shift(i, 1)}>
                        <ArrowRight />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Unpin ${album.title}`} onClick={() => toggle(album)} className="ml-auto">
                        <X />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-[3px] border border-dashed border-border text-xs text-muted-foreground">
                    Slot {i + 1}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div>
        <p className="eyebrow mb-3">All favourites</p>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {favorites.map(({ album }) => {
            const on = pinnedIds.has(album.id);
            return (
              <li key={album.id}>
                <button
                  type="button"
                  onClick={() => toggle(album)}
                  aria-pressed={on}
                  aria-label={`${on ? "Unpin" : "Pin"} ${album.title}`}
                  className={cn("relative block w-full rounded-[3px] transition", on ? "ring-2 ring-signal" : "opacity-80 hover:opacity-100")}
                >
                  <AlbumCover src={album.cover_url} title={album.title} artist={album.artist_credit} sizes="100px" />
                  {on ? (
                    <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-signal text-signal-foreground">
                      <Pin className="size-3" aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending} className="h-10 min-w-32 font-semibold">
          {pending ? "Saving…" : "Save showcase"}
        </Button>
      </div>
    </div>
  );
}
