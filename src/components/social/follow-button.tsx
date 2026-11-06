"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setFollowing } from "@/features/social/actions";

/**
 * Optimistic follow toggle. The server action re-derives the follower from the
 * session; only the target id is sent.
 */
export function FollowButton({
  userId,
  initialFollowing,
  isSignedIn,
  size = "sm",
  className,
  onChange,
}: {
  userId: string;
  initialFollowing: boolean;
  isSignedIn: boolean;
  size?: "sm" | "default";
  className?: string;
  onChange?: (following: boolean) => void;
}) {
  const router = useRouter();
  const [following, setFollowingState] = useState(initialFollowing);
  const [optimistic, setOptimistic] = useOptimistic(following);
  const [pending, startTransition] = useTransition();
  const [hovering, setHovering] = useState(false);

  function toggle() {
    if (!isSignedIn) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const next = !following;
    startTransition(async () => {
      setOptimistic(next);
      const result = await setFollowing(userId, next);
      if (result.ok) {
        setFollowingState(result.data.following);
        onChange?.(result.data.following);
      } else {
        toast.error(result.error);
      }
    });
  }

  const label = optimistic ? (hovering ? "Unfollow" : "Following") : "Follow";

  return (
    <Button
      type="button"
      size={size}
      variant={optimistic ? "secondary" : "default"}
      aria-pressed={optimistic}
      disabled={pending}
      onClick={toggle}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      className={cn(
        "min-w-[6.5rem] font-semibold",
        optimistic && hovering && "text-destructive",
        className,
      )}
    >
      {optimistic ? <Check data-icon="inline-start" /> : <UserPlus data-icon="inline-start" />}
      {label}
    </Button>
  );
}
