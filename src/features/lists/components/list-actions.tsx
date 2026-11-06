"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setListLiked } from "@/features/lists/actions";

export function ListLikeButton({
  listId,
  initialLiked,
  initialCount,
  isSignedIn,
  disabled,
}: {
  listId: string;
  initialLiked: boolean;
  initialCount: number;
  isSignedIn: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState({ liked: initialLiked, count: initialCount });
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!isSignedIn) {
      router.push(`/login?next=${encodeURIComponent(`/list/${listId}`)}`);
      return;
    }
    const next = { liked: !state.liked, count: state.count + (state.liked ? -1 : 1) };
    startTransition(async () => {
      setOptimistic(next);
      const result = await setListLiked(listId, next.liked);
      if (result.ok) setState(next);
      else toast.error(result.error);
    });
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={toggle}
      disabled={pending || disabled}
      aria-pressed={optimistic.liked}
      aria-label={optimistic.liked ? "Unlike list" : "Like list"}
    >
      <Heart
        data-icon="inline-start"
        className={cn("transition-colors", optimistic.liked && "fill-signal text-signal")}
      />
      <span className="font-mono tabular-nums">{optimistic.count}</span>
    </Button>
  );
}

export function ShareButton({ path, title }: { path: string; title: string }) {
  async function share() {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }
  return (
    <Button type="button" variant="secondary" size="sm" onClick={share}>
      <Share2 data-icon="inline-start" /> Share
    </Button>
  );
}
