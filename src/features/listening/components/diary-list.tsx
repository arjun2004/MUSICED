"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Heart, Pencil, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlbumCover } from "@/components/albums/album-cover";
import { StarRating } from "@/components/shared/star-rating";
import { deleteLog } from "@/features/listening/actions";
import type { DiaryEntry } from "@/features/listening/queries";
import { VisibilityBadge } from "@/features/lists/components/visibility-badge";
import { LogForm } from "./log-form";

/** Chronological diary grouped by month, with inline edit/delete for the owner. */
export function DiaryList({ entries, isOwner }: { entries: DiaryEntry[]; isOwner: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [rows, setRows] = useState(entries);
  const [, startTransition] = useTransition();

  const months: { key: string; label: string; entries: DiaryEntry[] }[] = [];
  for (const entry of rows) {
    const key = entry.listened_on.slice(0, 7);
    let group = months.at(-1);
    if (!group || group.key !== key) {
      group = { key, label: format(parseISO(`${key}-01`), "MMMM yyyy"), entries: [] };
      months.push(group);
    }
    group.entries.push(entry);
  }

  function remove(entry: DiaryEntry) {
    const previous = rows;
    setRows(rows.filter((r) => r.id !== entry.id));
    startTransition(async () => {
      const result = await deleteLog(entry.id);
      if (!result.ok) {
        setRows(previous);
        toast.error(result.error);
      } else {
        toast.success("Diary entry deleted.");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-10">
      {months.map((month) => (
        <section key={month.key} aria-label={month.label}>
          <h2 className="eyebrow sticky top-14 z-10 -mx-1 mb-1 bg-background/90 px-1 py-2 backdrop-blur">{month.label}</h2>
          <ol className="divide-y divide-hairline">
            {month.entries.map((entry) => (
              <li key={entry.id} className="grid grid-cols-[2.75rem_3.5rem_minmax(0,1fr)_auto] items-center gap-3 py-3 sm:grid-cols-[3.5rem_4rem_minmax(0,1fr)_auto] sm:gap-4">
                <div className="text-center">
                  <p className="text-xl leading-none font-semibold tabular-nums sm:text-2xl">{format(parseISO(entry.listened_on), "d")}</p>
                  <p className="eyebrow mt-1 !text-[0.5625rem]">{format(parseISO(entry.listened_on), "EEE")}</p>
                </div>
                <Link href={`/album/${entry.album.slug}`}>
                  <AlbumCover src={entry.album.cover_url} title={entry.album.title} artist={entry.album.artist_credit} sizes="64px" />
                </Link>
                <div className="min-w-0">
                  <Link href={`/album/${entry.album.slug}`} className="hover:text-signal">
                    <p className="truncate text-sm font-medium sm:text-[0.9375rem]">{entry.album.title}</p>
                  </Link>
                  <p className="truncate text-xs text-muted-foreground sm:text-[0.8125rem]">
                    {entry.album.artist_credit}
                    {entry.album.release_year ? ` · ${entry.album.release_year}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {entry.rating !== null ? <StarRating value={entry.rating} size={11} compact /> : null}
                    {entry.is_favorite ? <Heart className="size-3.5 fill-signal text-signal" aria-label="Loved" /> : null}
                    {entry.is_relisten ? <Repeat className="size-3.5 text-muted-foreground" aria-label="Re-listen" /> : null}
                    {isOwner ? <VisibilityBadge visibility={entry.visibility} /> : null}
                  </div>
                  {entry.note ? <p className="mt-1.5 line-clamp-2 text-[0.8125rem] text-foreground/75 italic">“{entry.note}”</p> : null}
                </div>
                {isOwner ? (
                  <div className="flex">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit entry for ${entry.album.title}`} onClick={() => setEditing(entry)}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete entry for ${entry.album.title}`}
                      className="hover:text-destructive"
                      onClick={() => remove(entry)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit diary entry</DialogTitle>
            <DialogDescription className="truncate">{editing?.album.title}</DialogDescription>
          </DialogHeader>
          {editing ? (
            <LogForm
              logId={editing.id}
              initial={{
                listenedOn: editing.listened_on,
                rating: editing.rating,
                note: editing.note ?? "",
                isRelisten: editing.is_relisten,
                isFavorite: editing.is_favorite,
                visibility: editing.visibility,
              }}
              onDone={(values) => {
                setRows((current) =>
                  current
                    .map((r) =>
                      r.id === editing.id
                        ? {
                            ...r,
                            listened_on: values.listenedOn,
                            rating: values.rating,
                            note: values.note.trim() || null,
                            is_relisten: values.isRelisten,
                            is_favorite: values.isFavorite,
                            visibility: values.visibility,
                          }
                        : r,
                    )
                    .sort((a, b) => b.listened_on.localeCompare(a.listened_on) || b.created_at.localeCompare(a.created_at)),
                );
                setEditing(null);
                router.refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
