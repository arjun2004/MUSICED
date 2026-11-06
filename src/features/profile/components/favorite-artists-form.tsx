"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArtistsStep } from "@/features/onboarding/components/artists-and-rating-steps";

export function FavoriteArtistsForm({ initial }: { initial: { id: string; name: string }[] }) {
  return (
    <ArtistsStep
      initial={initial}
      renderNav={({ save, pending, count }) => (
        <div className="mt-6 flex items-center justify-between">
          <p className="font-mono text-xs text-muted-foreground tabular-nums">{count}/12 selected</p>
          <Button className="h-10 min-w-32 font-semibold" disabled={pending} onClick={() => save(() => toast.success("Favorite artists saved."))}>
            {pending ? "Saving…" : "Save artists"}
          </Button>
        </div>
      )}
    />
  );
}
