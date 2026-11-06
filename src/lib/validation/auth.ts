import { z } from "zod";

/** Mirrors the profiles_username_reserved constraint in the database. */
export const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "musiced", "support", "help", "settings", "login",
  "signup", "logout", "onboarding", "explore", "discover", "diary", "charts",
  "album", "albums", "artist", "artists", "list", "lists", "user", "users",
  "api", "auth", "root", "system", "moderator", "staff", "null", "undefined",
  "me", "about", "terms", "privacy", "members", "notifications", "search",
]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Usernames need at least 3 characters")
  .max(24, "Usernames can be at most 24 characters")
  .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores only")
  .refine((value) => !RESERVED_USERNAMES.has(value), "That username is reserved");

export const emailSchema = z.email("Enter a valid email address").trim().toLowerCase().max(254);

/** Mirrors Supabase Auth settings: min 8, letters and digits. */
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Passwords can be at most 72 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const signUpSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(72),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
