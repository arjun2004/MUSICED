"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, NotebookPen, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StarRatingInput } from "@/components/shared/star-rating-input";
import { cn } from "@/lib/utils";
import { formatPartialDate } from "@/lib/utils/format";
import { setFavorite, setRating } from "@/features/listening/actions";
import type { ViewerAlbumState, ViewerReview } from "@/features/listening/queries";
import { LogForm, today } from "./log-form";
import { ReviewEditor } from "./review-editor";

/**
 * The viewer's controls on an album page: instant half-star rating, log a
 * listen, write/edit a review, favourite. Signed-out visitors are sent to log in.
 */
export function AlbumActions({
  albumId,
  albumTitle,
  albumPath,
  state,
}: {
  albumId: string;
  albumTitle: string;
  albumPath: string;
  state: ViewerAlbumState;
}) {
  const router = useRouter();
  const [rating, setRatingState] = useState(state.rating);
  const [favorite, setFavoriteState] = useState(state.favorite);
  const [review, setReview] = useState<ViewerReview | null>(state.review);
  const [logCount, setLogCount] = useState(state.logCount);
  const [lastListened, setLastListened] = useState(state.lastListenedOn);
  const [dialog, setDialog] = useState<"log" | "review" | null>(null);
  const [pending, startTransition] = useTransition();

  if (!state.signedIn) {
    return (
      <div className="grid gap-2 rounded-md border border-border bg-background/60 p-4 backdrop-blur-sm">
        <p className="text-sm text-muted-foreground">Sign in to rate, log and review this album.</p>
        <Button asChild className="font-semibold">
          <Link href={`/login?next=${encodeURIComponent(albumPath)}`}>Sign in</Link>
        </Button>
      </div>
    );
  }

  function rate(next: number | null) {
    const previous = rating;
    setRatingState(next);
    startTransition(async () => {
      const result = await setRating(albumId, next);
      if (!result.ok) {
        setRatingState(previous);
        toast.error(result.error);
      } else {
        toast.success(next === null ? "Rating removed." : "Rating saved.");
        router.refresh();
      }
    });
  }

  function toggleFavorite() {
    const next = !favorite;
    setFavoriteState(next);
    startTransition(async () => {
      const result = await setFavorite(albumId, next);
      if (!result.ok) {
        setFavoriteState(!next);
        toast.error(result.error);
        return;
      }
      toast.success(
        next
          ? result.data.slot
            ? "Added to favourites and pinned to your profile."
            : "Added to favourites."
          : "Removed from favourites.",
      );
    });
  }

  return (
    <div className="rounded-md border border-border bg-background/60 p-4 backdrop-blur-sm">
      <p className="eyebrow mb-2">Your rating</p>
      <StarRatingInput value={rating} onChange={rate} size={26} disabled={pending} showLabel />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <ActionButton icon={NotebookPen} label="Log" active={logCount > 0} onClick={() => setDialog("log")} />
        <ActionButton icon={PenLine} label={review ? "Edit review" : "Review"} active={Boolean(review)} onClick={() => setDialog("review")} />
        <ActionButton icon={Heart} label={favorite ? "Favourite" : "Favourite"} active={favorite} onClick={toggleFavorite} fill />
      </div>

      {logCount > 0 || review ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {logCount > 0 ? (
            <>
              Logged {logCount} {logCount === 1 ? "time" : "times"}
              {lastListened ? `, last on ${formatPartialDate(lastListened)}` : ""}.{" "}
            </>
          ) : null}
          {review ? (
            <Link href={`/review/${review.id}`} className="text-foreground underline-offset-2 hover:underline">
              Read your review
            </Link>
          ) : null}
        </p>
      ) : null}

      <Dialog open={dialog === "log"} onOpenChange={(open) => setDialog(open ? "log" : null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log a listen</DialogTitle>
            <DialogDescription className="truncate">{albumTitle}</DialogDescription>
          </DialogHeader>
          <LogForm
            albumId={albumId}
            initial={{
              listenedOn: today(),
              rating,
              note: "",
              isRelisten: logCount > 0,
              isFavorite: false,
              visibility: state.defaults.logVisibility,
            }}
            onDone={(values) => {
              setLogCount((n) => n + 1);
              setLastListened(values.listenedOn);
              if (values.rating !== null) setRatingState(values.rating);
              setDialog(null);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "review"} onOpenChange={(open) => setDialog(open ? "review" : null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{review ? "Edit your review" : "Write a review"}</DialogTitle>
            <DialogDescription className="truncate">{albumTitle}</DialogDescription>
          </DialogHeader>
          <ReviewEditor
            albumId={albumId}
            existing={review}
            defaultRating={rating}
            defaultVisibility={state.defaults.reviewVisibility}
            onSaved={(saved) => {
              setReview(saved);
              if (saved.rating !== null) setRatingState(saved.rating);
              setDialog(null);
              router.refresh();
            }}
            onDeleted={() => {
              setReview(null);
              setDialog(null);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  active,
  onClick,
  fill,
}: {
  icon: typeof Heart;
  label: string;
  active: boolean;
  onClick: () => void;
  fill?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-center gap-1 rounded-md border px-2 py-2.5 text-xs font-medium transition-colors",
        active ? "border-signal/40 bg-signal/10 text-signal" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      <Icon className={cn("size-4", active && fill && "fill-signal")} aria-hidden="true" />
      {label}
    </button>
  );
}
