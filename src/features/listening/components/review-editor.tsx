"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { StarRatingInput } from "@/components/shared/star-rating-input";
import type { Visibility } from "@/types/domain";
import { deleteReview, saveReview } from "@/features/listening/actions";
import type { ViewerReview } from "@/features/listening/queries";
import { VISIBILITY_LABELS } from "@/features/lists/components/visibility-badge";

/** Write or edit the viewer's one review of an album. */
export function ReviewEditor({
  albumId,
  existing,
  defaultRating,
  defaultVisibility,
  onSaved,
  onDeleted,
}: {
  albumId: string;
  existing: ViewerReview | null;
  defaultRating: number | null;
  defaultVisibility: Visibility;
  onSaved: (review: ViewerReview) => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [rating, setRating] = useState<number | null>(existing ? existing.rating : defaultRating);
  const [spoilers, setSpoilers] = useState(existing?.contains_spoilers ?? false);
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? defaultVisibility);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveReview(albumId, { title, body, rating, containsSpoilers: spoilers, visibility });
      if (!result.ok) {
        setError(result.fieldErrors ? Object.values(result.fieldErrors)[0] : result.error);
        return;
      }
      toast.success(result.message ?? "Saved.");
      onSaved({ id: result.data.id, title: title.trim() || null, body: body.trim(), rating, contains_spoilers: spoilers, visibility });
    });
  }

  function remove() {
    if (!existing) return;
    startTransition(async () => {
      const result = await deleteReview(existing.id);
      if (result.ok) {
        toast.success(result.message ?? "Deleted.");
        onDeleted();
      } else toast.error(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-1.5">
        <span className="text-[0.8125rem] font-medium">Your rating</span>
        <StarRatingInput value={rating} onChange={setRating} size={26} aria-label="Rating attached to this review" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="review-title" className="text-[0.8125rem]">Headline</Label>
        <Input id="review-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Optional" className="h-10" />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="review-body" className="text-[0.8125rem]">Review</Label>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">{body.length.toLocaleString()}/20,000</span>
        </div>
        <Textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={20000}
          rows={9}
          required
          placeholder="What did it make you feel? Mention people with @username."
          className="min-h-48 leading-relaxed"
        />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={spoilers} onCheckedChange={setSpoilers} aria-label="Contains spoilers" />
            Contains spoilers
          </label>
          <div className="grid gap-1.5">
            <Label htmlFor="review-visibility" className="text-[0.8125rem]">Visibility</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as Visibility)}>
              <SelectTrigger id="review-visibility" className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["public", "followers", "private"] as const).map((v) => (
                  <SelectItem key={v} value={v}>{VISIBILITY_LABELS[v]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          {existing ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={pending}>Delete</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your review?</AlertDialogTitle>
                  <AlertDialogDescription>Its likes and comments go with it. Your rating and diary stay.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={remove}>Delete review</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          <Button type="submit" className="h-10 min-w-32 font-semibold" disabled={pending || !body.trim()}>
            {pending ? "Saving…" : existing ? "Update review" : "Publish review"}
          </Button>
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
