import { z } from "zod";

export const ratingSchema = z
  .number()
  .min(0.5, "Ratings start at half a star")
  .max(5, "Ratings go up to five stars")
  .refine((v) => Number.isInteger(v * 2), "Ratings move in half stars");

const visibility = z.enum(["public", "followers", "private"]);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters`)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional();

export const logSchema = z.object({
  listenedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .refine((d) => d >= "1900-01-01", "That date is too far back")
    .refine((d) => d <= new Date(Date.now() + 36 * 3600_000).toISOString().slice(0, 10), "That date is in the future"),
  rating: ratingSchema.nullable(),
  note: optionalText(1000, "Notes"),
  isRelisten: z.boolean(),
  isFavorite: z.boolean(),
  visibility,
});

export type LogInput = z.input<typeof logSchema>;

export const reviewSchema = z.object({
  title: optionalText(140, "Titles"),
  body: z.string().trim().min(1, "Write something first").max(20000, "Reviews can be at most 20,000 characters"),
  rating: ratingSchema.nullable(),
  containsSpoilers: z.boolean(),
  visibility,
});

export type ReviewInput = z.input<typeof reviewSchema>;

export const commentSchema = z
  .string()
  .trim()
  .min(1, "Write a comment first")
  .max(2000, "Comments can be at most 2,000 characters");

export const reportSchema = z.object({
  targetType: z.enum(["review", "comment", "list", "profile"]),
  targetId: z.uuid(),
  reason: z.enum([
    "spam", "harassment", "hate", "sexual_content", "violence",
    "impersonation", "misinformation", "copyright", "other",
  ]),
  details: optionalText(2000, "Details"),
});

export type ReportInput = z.input<typeof reportSchema>;
