"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/form-field";
import { applyFieldErrors } from "@/lib/forms";
import { listDetailsSchema, type ListDetailsInput } from "@/lib/validation/lists";
import { createList, updateListDetails } from "@/features/lists/actions";
import { VISIBILITY_LABELS } from "./visibility-badge";

export function ListDetailsForm({
  listId,
  initial,
  submitLabel,
}: {
  /** Omit to create a new list. */
  listId?: string;
  initial: ListDetailsInput;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ListDetailsInput>({ resolver: zodResolver(listDetailsSchema), defaultValues: initial });
  const { errors, isDirty } = form.formState;
  const description = useWatch({ control: form.control, name: "description" }) ?? "";

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = listId ? await updateListDetails(listId, values) : await createList(values);
      if (!result.ok) {
        toast.error(result.error);
        applyFieldErrors(result, form.setError);
        return;
      }
      if (!listId && result.data && "id" in (result.data as object)) {
        router.push(`/list/${(result.data as { id: string }).id}/edit`);
      } else {
        toast.success(result.message ?? "Saved.");
        form.reset(values);
        router.refresh();
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormField label="Title" error={errors.title?.message}>
        {(field) => (
          <Input
            {...field}
            {...form.register("title")}
            maxLength={120}
            placeholder="Albums that sound like rain on a window"
            className="h-10"
            autoFocus={!listId}
          />
        )}
      </FormField>
      <FormField
        label="Description"
        error={errors.description?.message}
        labelAside={<span className="font-mono text-xs text-muted-foreground tabular-nums">{description.length}/2000</span>}
      >
        {(field) => (
          <Textarea {...field} {...form.register("description")} rows={3} maxLength={2000} placeholder="Optional. What ties these records together?" />
        )}
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5">
          <div>
            <Label htmlFor="is-ranked" className="text-sm font-medium">
              Ranked list
            </Label>
            <p className="text-xs text-muted-foreground">Show numbers next to each album.</p>
          </div>
          <Controller
            control={form.control}
            name="isRanked"
            render={({ field }) => <Switch id="is-ranked" checked={field.value} onCheckedChange={field.onChange} />}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="visibility" className="text-[0.8125rem] font-medium text-foreground/90">
            Who can see it
          </Label>
          <Controller
            control={form.control}
            name="visibility"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="visibility" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["public", "followers", "private"] as const).map((v) => (
                    <SelectItem key={v} value={v}>
                      {VISIBILITY_LABELS[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" className="h-10 min-w-32 font-semibold" disabled={pending || (Boolean(listId) && !isDirty)}>
          {pending
            ? "Saving…"
            : (submitLabel ?? (listId ? (isDirty ? "Save details" : "Details saved") : "Create list"))}
        </Button>
      </div>
    </form>
  );
}
