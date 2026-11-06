"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ListPlus, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  addAlbumToList,
  createList,
  getMyListsForAlbum,
  removeAlbumFromList,
  type MyListForAlbum,
} from "@/features/lists/actions";
import { VisibilityBadge } from "./visibility-badge";

export function AddToListDialog({
  albumId,
  albumTitle,
  isSignedIn,
}: {
  albumId: string;
  albumTitle: string;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<MyListForAlbum[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [, startTransition] = useTransition();

  function load() {
    setLists(null);
    startTransition(async () => {
      const result = await getMyListsForAlbum(albumId);
      if (result.ok) setLists(result.data);
      else {
        toast.error(result.error);
        setOpen(false);
      }
    });
  }

  function toggle(list: MyListForAlbum) {
    setBusy(list.id);
    startTransition(async () => {
      const result = list.containsAlbum
        ? await removeAlbumFromList(list.id, albumId)
        : await addAlbumToList(list.id, albumId);
      setBusy(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLists((current) =>
        (current ?? []).map((l) =>
          l.id === list.id
            ? { ...l, containsAlbum: !l.containsAlbum, items_count: l.items_count + (l.containsAlbum ? -1 : 1) }
            : l,
        ),
      );
      toast.success(list.containsAlbum ? `Removed from “${list.title}”.` : `Added to “${list.title}”.`);
    });
  }

  function create() {
    const title = newTitle.trim();
    if (!title) return;
    setBusy("new");
    startTransition(async () => {
      const result = await createList({ title, isRanked: false, visibility: "public" }, albumId);
      setBusy(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setNewTitle("");
      setLists((current) => [
        { id: result.data.id, title, items_count: 1, visibility: "public", containsAlbum: true },
        ...(current ?? []),
      ]);
      toast.success(`Created “${title}”.`, {
        action: { label: "Edit list", onClick: () => router.push(`/list/${result.data.id}/edit`) },
      });
    });
  }

  if (!isSignedIn) {
    return (
      <Button asChild variant="secondary" className="w-full">
        <Link href="/login">
          <ListPlus data-icon="inline-start" /> Add to a list
        </Link>
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) load();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full">
          <ListPlus data-icon="inline-start" /> Add to a list
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to a list</DialogTitle>
          <DialogDescription className="truncate">{albumTitle}</DialogDescription>
        </DialogHeader>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New list title"
            aria-label="New list title"
            maxLength={120}
            className="h-9"
          />
          <Button type="submit" size="sm" className="h-9" disabled={!newTitle.trim() || busy === "new"}>
            {busy === "new" ? <Loader2 className="animate-spin" /> : <Plus data-icon="inline-start" />}
            Create
          </Button>
        </form>

        <div className="-mx-2 max-h-80 overflow-y-auto">
          {lists === null ? (
            <div className="grid gap-2 px-2 py-1" aria-hidden="true">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : lists.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">You haven&apos;t made any lists yet. Create one above.</p>
          ) : (
            <ul>
              {lists.map((list) => (
                <li key={list.id}>
                  <button
                    type="button"
                    onClick={() => toggle(list)}
                    disabled={busy === list.id}
                    aria-pressed={list.containsAlbum}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-surface"
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-[4px] border",
                        list.containsAlbum ? "border-signal bg-signal text-signal-foreground" : "border-border",
                      )}
                      aria-hidden="true"
                    >
                      {busy === list.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : list.containsAlbum ? (
                        <Check className="size-3.5" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{list.title}</span>
                      <span className="font-mono text-xs text-muted-foreground">{list.items_count} albums</span>
                    </span>
                    <VisibilityBadge visibility={list.visibility} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
