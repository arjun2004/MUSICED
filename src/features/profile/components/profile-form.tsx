"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { applyFieldErrors } from "@/lib/forms";
import { profileSchema } from "@/lib/validation/profile";
import { UsernameInput } from "@/features/authentication/components/username-input";
import { updateProfile } from "@/features/profile/actions";

type Values = z.input<typeof profileSchema>;

export function ProfileForm({ initial }: { initial: { username: string; displayName: string; bio: string; location: string; website: string } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(profileSchema),
    defaultValues: initial,
    mode: "onTouched",
  });
  const { errors, isDirty } = form.formState;
  const watchedUsername = useWatch({ control: form.control, name: "username" }) ?? "";
  const watchedBio = useWatch({ control: form.control, name: "bio" }) ?? "";

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await updateProfile(values);
      if (result.ok) {
        toast.success(result.message ?? "Saved.");
        form.reset(values);
        router.refresh();
      } else {
        toast.error(result.error);
        applyFieldErrors(result, form.setError);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <UsernameInput
        registration={form.register("username")}
        error={errors.username?.message}
        watchValue={watchedUsername}
        currentUsername={initial.username}
      />
      <FormField label="Display name" error={errors.displayName?.message}>
        {(field) => <Input {...field} {...form.register("displayName")} maxLength={50} className="h-10" />}
      </FormField>
      <FormField
        label="Bio"
        error={errors.bio?.message}
        labelAside={<span className="font-mono text-xs text-muted-foreground tabular-nums">{watchedBio.length}/300</span>}
      >
        {(field) => <Textarea {...field} {...form.register("bio")} rows={4} maxLength={300} />}
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Location" error={errors.location?.message}>
          {(field) => <Input {...field} {...form.register("location")} maxLength={60} className="h-10" />}
        </FormField>
        <FormField label="Website" error={errors.website?.message}>
          {(field) => (
            <Input {...field} {...form.register("website")} type="url" placeholder="https://" maxLength={200} className="h-10" />
          )}
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="submit" className="h-10 min-w-32 font-semibold" disabled={pending || !isDirty}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
