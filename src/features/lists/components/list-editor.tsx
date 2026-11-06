"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, ChevronsDown, ChevronsUp, GripVertical, Loader2, Trash2, X } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlbumCover } from "@/components/albums/album-cover";
import { cn } from "@/lib/utils";
import type { AlbumSummary } from "@/types/domain";
import { AlbumPicker, type PickedAlbum } from "@/features/catalog/components/album-picker";
import { importAlbumAction } from "@/features/catalog/actions";
import {
  addAlbumToList,
  deleteList,
  removeAlbumFromList,
  reorderList,
  updateListItemNote,
} from "@/features/lists/actions";

type Item = { id: string; note: string | null; album: AlbumSummary };

export function ListEditor({
  listId,
  listTitle,
  isRanked,
  initialItems,
}: {
  listId: string;
  listTitle: string;
  isRanked: boolean;
  initialItems: Item[];
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Map external (MusicBrainz) ids to local album ids once imported.
  const imported = useRef(new Map<string, string>());

  const albumIds = new Set(items.map((i) => i.album.id));
  const isAdded = (key: string) => albumIds.has(key) || albumIds.has(imported.current.get(key) ?? "");

  function pick(picked: PickedAlbum) {
    const key = picked.kind === "local" ? picked.album.id : picked.hit.externalId;
    setBusyKey(key);
    startTransition(async () => {
      let album: AlbumSummary;
      if (picked.kind === "local") {
        album = picked.album;
      } else {
        const result = await importAlbumAction(picked.hit.externalId);
        if (!result.ok) {
          toast.error(result.error);
          setBusyKey(null);
          return;
        }
        imported.current.set(picked.hit.externalId, result.data.id);
        album = {
          id: result.data.id,
          slug: result.data.slug,
          title: picked.hit.title,
          artist_credit: picked.hit.artistCredit,
          release_year: picked.hit.releaseYear,
          cover_url: picked.hit.coverUrl,
        };
        if (albumIds.has(album.id)) {
          toast.message("That album is already in this list.");
          setBusyKey(null);
          return;
        }
      }

      const result = await addAlbumToList(listId, album.id);
      setBusyKey(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setItems((current) => [...current, { id: result.data.itemId, note: null, album }]);
      toast.success(`Added ${album.title}.`);
    });
  }

  function persistOrder(next: Item[], previous: Item[]) {
    setItems(next);
    startTransition(async () => {
      const result = await reorderList(listId, next.map((i) => i.id));
      if (!result.ok) {
        setItems(previous);
        toast.error(result.error);
      }
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    persistOrder(arrayMove(items, from, to), items);
  }

  function move(index: number, to: number) {
    if (to < 0 || to >= items.length || to === index) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved);
    persistOrder(next, items);
  }

  function remove(item: Item) {
    const previous = items;
    setItems(items.filter((i) => i.id !== item.id));
    startTransition(async () => {
      const result = await removeAlbumFromList(listId, item.album.id);
      if (!result.ok) {
        setItems(previous);
        toast.error(result.error);
      }
    });
  }

  function saveNote(item: Item, note: string) {
    if ((item.note ?? "") === note.trim()) return;
    startTransition(async () => {
      const result = await updateListItemNote(listId, item.id, note);
      if (result.ok) {
        setItems((current) => current.map((i) => (i.id === item.id ? { ...i, note: note.trim() || null } : i)));
        toast.success("Note saved.");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-labelledby="list-items-heading">
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-hairline pb-3">
          <div>
            <h2 id="list-items-heading" className="text-lg font-semibold tracking-tight">
              Albums <span className="font-mono text-sm text-muted-foreground">{items.length}</span>
            </h2>
            <p className="text-xs text-muted-foreground">Changes save automatically as you add, move or remove albums.</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
              {pending || busyKey ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Saving…
                </>
              ) : (
                <>
                  <Check className="size-3.5 text-signal" aria-hidden="true" /> All changes saved
                </>
              )}
            </span>
            <Button asChild size="sm" className="font-semibold">
              <Link href={`/list/${listId}`}>Done</Link>
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            Your list is empty. Search for albums on the right to start adding.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ol className="divide-y divide-hairline">
                {items.map((item, index) => (
                  <SortableRow key={item.id} id={item.id}>
                    {(handle) => (
                      <>
                        {handle}
                        <span
                          className={cn(
                            "w-7 shrink-0 pt-1 text-right font-mono text-sm tabular-nums",
                            isRanked ? "text-foreground" : "text-muted-foreground/50",
                          )}
                          aria-label={isRanked ? `Rank ${index + 1}` : undefined}
                        >
                          {index + 1}
                        </span>
                        <div className="w-14 shrink-0">
                          <AlbumCover src={item.album.cover_url} title={item.album.title} artist={item.album.artist_credit} sizes="56px" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.album.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.album.artist_credit}
                            {item.album.release_year ? ` · ${item.album.release_year}` : ""}
                          </p>
                          <NoteField item={item} onSave={(note) => saveNote(item, note)} />
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-start">
                          <div className="flex">
                            <IconButton label="Move to top" onClick={() => move(index, 0)} disabled={index === 0}>
                              <ChevronsUp />
                            </IconButton>
                            <IconButton label="Move up" onClick={() => move(index, index - 1)} disabled={index === 0}>
                              <ArrowUp />
                            </IconButton>
                            <IconButton label="Move down" onClick={() => move(index, index + 1)} disabled={index === items.length - 1}>
                              <ArrowDown />
                            </IconButton>
                            <IconButton label="Move to bottom" onClick={() => move(index, items.length - 1)} disabled={index === items.length - 1}>
                              <ChevronsDown />
                            </IconButton>
                          </div>
                          <IconButton label={`Remove ${item.album.title}`} onClick={() => remove(item)} destructive>
                            <X />
                          </IconButton>
                        </div>
                      </>
                    )}
                  </SortableRow>
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        <div className="mt-12 border-t border-hairline pt-6">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 data-icon="inline-start" /> Delete list
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{listTitle}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the list and its likes for good. The albums stay in MUSICED.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={(event) => {
                    event.preventDefault();
                    startTransition(async () => {
                      const result = await deleteList(listId);
                      if (result && !result.ok) toast.error(result.error);
                    });
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Add albums</h2>
        <AlbumPicker onPick={pick} isAdded={isAdded} busyKey={busyKey} />
      </aside>
    </div>
  );
}

/** A list row that can be dragged by its grip (mouse, touch, or keyboard: Space then arrows). */
function SortableRow({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      className="mt-1 flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical className="size-4" aria-hidden="true" />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex gap-2 bg-background py-3", isDragging && "relative z-10 rounded-md shadow-xl ring-1 ring-signal/40")}
    >
      {children(handle)}
    </li>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn("text-muted-foreground", destructive && "hover:text-destructive")}
    >
      {children}
    </Button>
  );
}

function NoteField({ item, onSave }: { item: Item; onSave: (note: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.note ?? "");

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-1.5 block max-w-full text-left text-xs text-muted-foreground hover:text-foreground"
      >
        {item.note ? <span className="line-clamp-2 italic">“{item.note}”</span> : "+ Add a note"}
      </button>
    );
  }

  return (
    <div className="mt-2">
      <Textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          onSave(value);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setValue(item.note ?? "");
            setEditing(false);
          }
        }}
        rows={2}
        maxLength={500}
        aria-label={`Note for ${item.album.title}`}
        placeholder="Why does this album belong here?"
        className="text-sm"
      />
      <p className="mt-1 text-right font-mono text-[0.625rem] text-muted-foreground">{value.length}/500</p>
    </div>
  );
}
