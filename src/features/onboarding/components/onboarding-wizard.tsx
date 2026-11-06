"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { FormAlert, FormField } from "@/components/shared/form-field";
import { ListenerRow, type ListenerRowData } from "@/components/social/listener-row";
import { cn } from "@/lib/utils";
import { applyFieldErrors } from "@/lib/forms";
import { onboardingProfileSchema } from "@/lib/validation/profile";
import { UsernameInput } from "@/features/authentication/components/username-input";
import { AvatarUploader } from "@/features/profile/components/avatar-uploader";
import {
  completeOnboarding,
  getOnboardingSuggestions,
  saveFavoriteGenres,
  saveOnboardingProfile,
} from "@/features/onboarding/actions";
import type { GenreOption } from "@/features/onboarding/queries";
import { ArtistsStep, RateStep } from "./artists-and-rating-steps";

const STEPS = ["Profile", "Photo", "Taste", "Artists", "Rate", "People"] as const;

type ProfileValues = z.input<typeof onboardingProfileSchema>;

export type OnboardingInitial = {
  viewerId: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarPath: string | null;
  genreSlugs: string[];
  artists: { id: string; name: string }[];
};

export function OnboardingWizard({
  initial,
  genres,
}: {
  initial: OnboardingInitial;
  genres: GenreOption[];
}) {
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState(initial.username);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [avatarPath, setAvatarPath] = useState(initial.avatarPath);

  return (
    <div>
      <ol className="mb-10 flex items-center gap-2" aria-label="Onboarding progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 flex-col gap-2">
            <span
              className={cn(
                "h-0.5 rounded-full transition-colors duration-300",
                index <= step ? "bg-signal" : "bg-border",
              )}
            />
            <span
              className={cn("eyebrow !text-[0.625rem]", index === step && "!text-foreground")}
              aria-current={index === step ? "step" : undefined}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {step === 0 ? (
            <ProfileStep
              initial={{ username: username ?? "", displayName: displayName ?? "", bio: initial.bio ?? "" }}
              currentUsername={initial.username}
              onDone={(values) => {
                setUsername(values.username);
                setDisplayName(values.displayName ?? null);
                setStep(1);
              }}
            />
          ) : null}
          {step === 1 ? (
            <PhotoStep
              user={{ username, display_name: displayName, avatar_path: avatarPath }}
              onUploaded={setAvatarPath}
              onBack={() => setStep(0)}
              onNext={() => setStep(2)}
            />
          ) : null}
          {step === 2 ? (
            <TasteStep
              genres={genres}
              initialSelected={initial.genreSlugs}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          ) : null}
          {step === 3 ? (
            <div>
              <StepHeading
                eyebrow="Step 4 of 6"
                title="Artists you love"
                description="Pick up to 12. Anyone on MusicBrainz is fair game: search and tap to add."
              />
              <ArtistsStep
                initial={initial.artists}
                renderNav={({ save, pending, count }) => (
                  <StepNav
                    onBack={() => setStep(2)}
                    onNext={() => save(() => setStep(4))}
                    pending={pending}
                    nextLabel={count ? "Continue" : "Skip for now"}
                  />
                )}
              />
            </div>
          ) : null}
          {step === 4 ? (
            <div>
              <StepHeading
                eyebrow="Step 5 of 6"
                title="Rate a few albums"
                description="Ratings save as you tap. They shape your recommendations and your profile."
              />
              <RateStep nav={<StepNav onBack={() => setStep(3)} onNext={() => setStep(5)} nextLabel="Continue" />} />
            </div>
          ) : null}
          {step === 5 ? <PeopleStep viewerId={initial.viewerId} onBack={() => setStep(4)} /> : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StepHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-8">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h1 className="heading text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ProfileStep({
  initial,
  currentUsername,
  onDone,
}: {
  initial: { username: string; displayName: string; bio: string };
  currentUsername: string | null;
  onDone: (values: { username: string; displayName?: string | null }) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ProfileValues>({
    resolver: zodResolver(onboardingProfileSchema),
    defaultValues: initial,
    mode: "onTouched",
  });
  const { errors } = form.formState;
  const watchedUsername = useWatch({ control: form.control, name: "username" }) ?? "";
  const watchedBio = useWatch({ control: form.control, name: "bio" }) ?? "";

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveOnboardingProfile(values);
      if (result.ok) {
        onDone({ username: values.username.trim().toLowerCase(), displayName: values.displayName?.trim() || null });
      } else {
        setFormError(result.error);
        applyFieldErrors(result, form.setError);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <StepHeading
        eyebrow="Step 1 of 6"
        title="Make it yours"
        description="This is how other listeners will find you and recognise your reviews."
      />
      <div className="grid gap-4">
        {formError ? <FormAlert>{formError}</FormAlert> : null}
        <UsernameInput
          registration={form.register("username")}
          error={errors.username?.message}
          watchValue={watchedUsername}
          currentUsername={currentUsername}
          autoFocus={!initial.username}
        />
        <FormField label="Display name" error={errors.displayName?.message} hint="Optional. Up to 50 characters.">
          {(field) => (
            <Input {...field} {...form.register("displayName")} autoComplete="nickname" maxLength={50} className="h-10" />
          )}
        </FormField>
        <FormField
          label="Bio"
          error={errors.bio?.message}
          labelAside={<span className="font-mono text-xs text-muted-foreground tabular-nums">{watchedBio.length}/300</span>}
        >
          {(field) => (
            <Textarea
              {...field}
              {...form.register("bio")}
              rows={3}
              maxLength={300}
              placeholder="Lifelong shoegaze apologist. Currently deep in 70s Ethiopian jazz."
            />
          )}
        </FormField>
      </div>
      <div className="mt-8 flex justify-end">
        <Button type="submit" className="h-10 min-w-32 font-semibold" disabled={pending}>
          {pending ? "Saving…" : "Continue"}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </form>
  );
}

function PhotoStep({
  user,
  onUploaded,
  onBack,
  onNext,
}: {
  user: { username: string | null; display_name: string | null; avatar_path: string | null };
  onUploaded: (path: string | null) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <StepHeading
        eyebrow="Step 2 of 6"
        title="Add a face to the name"
        description="A profile photo makes your reviews feel human. You can skip this for now."
      />
      <AvatarUploader user={user} onUploaded={onUploaded} />
      <StepNav onBack={onBack} onNext={onNext} nextLabel={user.avatar_path ? "Continue" : "Skip for now"} />
    </div>
  );
}

function TasteStep({
  genres,
  initialSelected,
  onBack,
  onNext,
}: {
  genres: GenreOption[];
  initialSelected: string[];
  onBack: () => void;
  onNext: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [pending, startTransition] = useTransition();
  const MAX = 12;

  function toggle(slug: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else if (next.size < MAX) next.add(slug);
      else toast.message(`You can pick up to ${MAX} genres.`);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await saveFavoriteGenres([...selected]);
      if (result.ok) onNext();
      else toast.error(result.error);
    });
  }

  return (
    <div>
      <StepHeading
        eyebrow="Step 3 of 6"
        title="What do you listen to?"
        description="Pick a few genres you love. We use them to suggest listeners with similar taste."
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Favorite genres">
        {genres.map((genre) => {
          const active = selected.has(genre.slug);
          return (
            <button
              key={genre.slug}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(genre.slug)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-all",
                active
                  ? "border-signal bg-signal text-signal-foreground"
                  : "border-border bg-surface text-foreground/85 hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {active ? <Check className="size-3.5" aria-hidden="true" /> : null}
              {genre.name}
            </button>
          );
        })}
      </div>
      <p className="mt-4 font-mono text-xs text-muted-foreground tabular-nums">
        {selected.size} selected{selected.size < 3 ? " · we recommend at least 3" : ""}
      </p>
      <StepNav onBack={onBack} onNext={save} pending={pending} nextLabel={selected.size ? "Continue" : "Skip for now"} />
    </div>
  );
}

function PeopleStep({ viewerId, onBack }: { viewerId: string; onBack: () => void }) {
  const [pending, startTransition] = useTransition();
  const [people, setPeople] = useState<ListenerRowData[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOnboardingSuggestions().then((result) => {
      if (cancelled) return;
      if (result.ok) setPeople(result.data as ListenerRowData[]);
      else setLoadError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function finish() {
    startTransition(async () => {
      const result = await completeOnboarding();
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <div>
      <StepHeading
        eyebrow="Step 6 of 6"
        title="Follow some listeners"
        description="Your feed is built from the people you follow. Start with a few whose taste overlaps yours."
      />
      <div className="divide-y divide-hairline">
        {people === null && !loadError
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))
          : null}
        {loadError ? <FormAlert tone="info">{loadError}</FormAlert> : null}
        {people?.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            You&apos;re early! There aren&apos;t other listeners to suggest yet. Invite a friend, or find
            people later in Listeners.
          </p>
        ) : null}
        {people?.map((person) => (
          <ListenerRow key={person.id} person={person} viewerId={viewerId} isFollowing={false} />
        ))}
      </div>
      <StepNav onBack={onBack} onNext={finish} pending={pending} nextLabel="Finish" />
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  nextLabel = "Continue",
  pending = false,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  pending?: boolean;
}) {
  return (
    <div className="mt-10 flex items-center justify-between">
      <Button type="button" variant="ghost" onClick={onBack} disabled={pending}>
        <ArrowLeft data-icon="inline-start" />
        Back
      </Button>
      <Button type="button" className="h-10 min-w-32 font-semibold" onClick={onNext} disabled={pending}>
        {pending ? "Saving…" : nextLabel}
        <ArrowRight data-icon="inline-end" />
      </Button>
    </div>
  );
}
