"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setReviewLiked } from "@/features/reviews/actions";

export function ReviewLikeButton({
  reviewId,
  initialLiked,
  initialCount,
  isSignedIn,
  disabled,
}: {
  reviewId: string;
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
      router.push(`/login?next=${encodeURIComponent(`/review/${reviewId}`)}`);
      return;
    }
    const next = { liked: !state.liked, count: state.count + (state.liked ? -1 : 1) };
    startTransition(async () => {
      setOptimistic(next);
      const result = await setReviewLiked(reviewId, next.liked);
      if (result.ok) setState(next);
      else toast.error(result.error);
    });
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={toggle}
      disabled={pending || disabled}
      aria-pressed={optimistic.liked}
      aria-label={optimistic.liked ? "Unlike review" : "Like review"}
      title={disabled ? "You can't like your own review" : undefined}
    >
      <Heart data-icon="inline-start" className={cn(optimistic.liked && "fill-signal text-signal")} />
      <span className="font-mono tabular-nums">{optimistic.count}</span>
    </Button>
  );
}
