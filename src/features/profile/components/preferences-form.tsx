"use client";

import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionHeader } from "@/components/shared/states";
import { preferencesSchema, type PreferencesInput } from "@/lib/validation/profile";
import { updatePreferences } from "@/features/profile/actions";

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Everyone" },
  { value: "followers", label: "Followers only" },
  { value: "private", label: "Only me" },
] as const;

const VISIBILITY_FIELDS = [
  { name: "defaultLogVisibility", label: "Diary entries", hint: "Who can see albums you log." },
  { name: "defaultReviewVisibility", label: "Reviews", hint: "Who can read reviews you write." },
  { name: "defaultListVisibility", label: "Lists", hint: "Who can see lists you create." },
] as const;

const NOTIFY_FIELDS = [
  { name: "notifyFollows", label: "New followers" },
  { name: "notifyLikes", label: "Likes on your reviews, comments and lists" },
  { name: "notifyComments", label: "Comments and replies" },
  { name: "notifyMentions", label: "@mentions" },
] as const;

export function PreferencesForm({ initial }: { initial: PreferencesInput }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<PreferencesInput>({ resolver: zodResolver(preferencesSchema), defaultValues: initial });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await updatePreferences(values);
      if (result.ok) {
        toast.success(result.message ?? "Saved.");
        form.reset(values);
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-12">
      <section>
        <SectionHeader title="Default visibility" />
        <p className="-mt-2 mb-6 text-sm text-muted-foreground">
          Applied to new entries. You can change visibility on any individual entry. Ratings are always public.
        </p>
        <div className="grid gap-5">
          {VISIBILITY_FIELDS.map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-6">
              <div>
                <Label htmlFor={item.name} className="text-sm font-medium">
                  {item.label}
                </Label>
                <p className="text-[0.8125rem] text-muted-foreground">{item.hint}</p>
              </div>
              <Controller
                control={form.control}
                name={item.name}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={item.name} className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIBILITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Notifications" />
        <div className="grid gap-4">
          {NOTIFY_FIELDS.map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-6">
              <Label htmlFor={item.name} className="text-sm font-normal">
                {item.label}
              </Label>
              <Controller
                control={form.control}
                name={item.name}
                render={({ field }) => (
                  <Switch id={item.name} checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" className="h-10 min-w-32 font-semibold" disabled={pending || !form.formState.isDirty}>
          {pending ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </form>
  );
}
