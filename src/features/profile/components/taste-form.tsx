"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveFavoriteGenres } from "@/features/onboarding/actions";
import type { GenreOption } from "@/features/onboarding/queries";

const MAX = 12;

export function TasteForm({ genres, initialSelected }: { genres: GenreOption[]; initialSelected: string[] }) {
  const [selected, setSelected] = useState(new Set(initialSelected));
  const [saved, setSaved] = useState(new Set(initialSelected));
  const [pending, startTransition] = useTransition();
  const dirty = selected.size !== saved.size || [...selected].some((id) => !saved.has(id));

  function toggle(slug: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else if (next.size < MAX) next.add(slug);
      else toast.message(`You can pick up to ${MAX} genres.`);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await saveFavoriteGenres([...selected]);
      if (result.ok) {
        setSaved(new Set(selected));
        toast.success("Taste updated.");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Favorite genres">
        {genres.map((genre) => {
          const active = selected.has(genre.slug);
          return (
            <button
              key={genre.slug}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(genre.slug)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-all",
                active
                  ? "border-signal bg-signal text-signal-foreground"
                  : "border-border bg-surface text-foreground/85 hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {active ? <Check className="size-3.5" aria-hidden="true" /> : null}
              {genre.name}
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <p className="font-mono text-xs text-muted-foreground tabular-nums">
          {selected.size}/{MAX} selected
        </p>
        <Button onClick={save} disabled={!dirty || pending} className="h-10 min-w-32 font-semibold">
          {pending ? "Saving…" : "Save taste"}
        </Button>
      </div>
    </div>
  );
}
