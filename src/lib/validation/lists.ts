import { z } from "zod";

export const listDetailsSchema = z.object({
  title: z.string().trim().min(1, "Give your list a title").max(120, "Titles can be at most 120 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Descriptions can be at most 2000 characters")
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional(),
  isRanked: z.boolean(),
  visibility: z.enum(["public", "followers", "private"]),
});

export type ListDetailsInput = z.input<typeof listDetailsSchema>;

export const listItemNoteSchema = z
  .string()
  .trim()
  .max(500, "Notes can be at most 500 characters")
  .transform((v) => (v.length === 0 ? null : v))
  .nullable();

export const LIST_MAX_ITEMS = 500;
