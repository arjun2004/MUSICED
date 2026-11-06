import { z } from "zod";
import { usernameSchema } from "./auth";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters`)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional();

export const profileSchema = z.object({
  username: usernameSchema,
  displayName: optionalText(50, "Display name"),
  bio: optionalText(300, "Bio"),
  location: optionalText(60, "Location"),
  website: z
    .string()
    .trim()
    .max(200, "Website can be at most 200 characters")
    .transform((value) => (value.length === 0 ? null : value))
    .refine(
      (value) => value === null || /^https?:\/\/[^\s]+$/i.test(value),
      "Website must start with http:// or https://",
    )
    .nullable()
    .optional(),
});

export type ProfileInput = z.input<typeof profileSchema>;

export const onboardingProfileSchema = profileSchema.pick({
  username: true,
  displayName: true,
  bio: true,
});

export type OnboardingProfileInput = z.input<typeof onboardingProfileSchema>;

export const favoriteGenresSchema = z.object({
  // Slugs, not UUIDs: slugs are stable across environments and DB resets, so a
  // cached genre list can never submit ids that no longer exist.
  genreSlugs: z
    .array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80))
    .max(12, "Pick up to 12 genres"),
});

export const preferencesSchema = z.object({
  defaultLogVisibility: z.enum(["public", "followers", "private"]),
  defaultReviewVisibility: z.enum(["public", "followers", "private"]),
  defaultListVisibility: z.enum(["public", "followers", "private"]),
  notifyFollows: z.boolean(),
  notifyLikes: z.boolean(),
  notifyComments: z.boolean(),
  notifyMentions: z.boolean(),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
