"use client";

import { useState, useTransition } from "react";
import { Heart, Repeat } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StarRatingInput } from "@/components/shared/star-rating-input";
import { cn } from "@/lib/utils";
import type { Visibility } from "@/types/domain";
import { logListen, updateLog } from "@/features/listening/actions";
import { VISIBILITY_LABELS } from "@/features/lists/components/visibility-badge";

export type LogFormValues = {
  listenedOn: string;
  rating: number | null;
  note: string;
  isRelisten: boolean;
  isFavorite: boolean;
  visibility: Visibility;
};

/** Local calendar date (not UTC) as YYYY-MM-DD. */
export function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** Create a diary entry for `albumId`, or edit `logId`. */
export function LogForm({
  albumId,
  logId,
  initial,
  onDone,
  submitLabel,
}: {
  albumId?: string;
  logId?: string;
  initial: LogFormValues;
  onDone: (values: LogFormValues) => void;
  submitLabel?: string;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof LogFormValues>(key: K, value: LogFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = logId
        ? await updateLog(logId, values)
        : await logListen(albumId!, values);
      if (!result.ok) {
        setError(result.fieldErrors ? Object.values(result.fieldErrors)[0] : result.error);
        return;
      }
      toast.success(result.message ?? "Saved.");
      onDone(values);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="grid gap-1.5">
          <Label htmlFor="listened-on" className="text-[0.8125rem]">Listened on</Label>
          <Input
            id="listened-on"
            type="date"
            value={values.listenedOn}
            max={today()}
            min="1900-01-01"
            onChange={(e) => set("listenedOn", e.target.value)}
            required
            className="h-10"
          />
        </div>
        <div className="grid gap-1.5">
          <span className="text-[0.8125rem] font-medium">Rating</span>
          <StarRatingInput value={values.rating} onChange={(r) => set("rating", r)} size={26} aria-label="Rating for this listen" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Toggle pressed={values.isFavorite} onChange={(v) => set("isFavorite", v)} icon={Heart} label="Loved it" />
        <Toggle pressed={values.isRelisten} onChange={(v) => set("isRelisten", v)} icon={Repeat} label="Re-listen" />
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="log-note" className="text-[0.8125rem]">Note</Label>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">{values.note.length}/1000</span>
        </div>
        <Textarea
          id="log-note"
          value={values.note}
          onChange={(e) => set("note", e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Optional. Where were you, what stood out?"
        />
        <p className="text-xs text-muted-foreground">Diary notes are separate from reviews.</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="log-visibility" className="text-[0.8125rem]">Who can see this entry</Label>
          <Select value={values.visibility} onValueChange={(v) => set("visibility", v as Visibility)}>
            <SelectTrigger id="log-visibility" className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["public", "followers", "private"] as const).map((v) => (
                <SelectItem key={v} value={v}>{VISIBILITY_LABELS[v]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="h-10 min-w-32 font-semibold" disabled={pending}>
          {pending ? "Saving…" : (submitLabel ?? (logId ? "Save entry" : "Log listen"))}
        </Button>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}

function Toggle({
  pressed,
  onChange,
  icon: Icon,
  label,
}: {
  pressed: boolean;
  onChange: (value: boolean) => void;
  icon: typeof Heart;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors",
        pressed ? "border-signal bg-signal/10 text-signal" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("size-4", pressed && Icon === Heart && "fill-signal")} aria-hidden="true" />
      {label}
    </button>
  );
}
