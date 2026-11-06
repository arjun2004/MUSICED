import { z } from "zod";

/**
 * Public (browser-safe) environment. Next.js inlines NEXT_PUBLIC_* values at
 * build time, so each variable must be referenced explicitly by name.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    error: "NEXT_PUBLIC_SUPABASE_URL is missing. Copy .env.example to .env.local and fill it in.",
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string({
      error:
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing. Run `npx supabase status` for local keys.",
    })
    .min(1),
  NEXT_PUBLIC_AUTH_GOOGLE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cached: PublicEnv | undefined;

export function publicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      // Legacy anon JWT keys are accepted for older projects.
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_AUTH_GOOGLE_ENABLED: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED || undefined,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid public environment:\n${parsed.error.issues.map((i) => `  - ${i.message}`).join("\n")}`,
    );
  }
  cached = parsed.data;
  return cached;
}
