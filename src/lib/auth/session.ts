import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

/**
 * Data Access Layer for the current user.
 *
 * All identity decisions on the server go through here. Identity comes from
 * the verified JWT (`getClaims()` validates the signature), never from
 * client-supplied ids. Results are memoised per request with React `cache`.
 *
 * These functions read cookies, so components calling them must render
 * behind a <Suspense> boundary (or a route `loading.tsx`).
 */

export type Viewer = {
  id: string;
  email: string | null;
};

export type ViewerProfile = Pick<
  Tables<"profiles">,
  "id" | "username" | "display_name" | "avatar_path" | "bio" | "onboarded_at" | "role" | "suspended_at"
>;

export const getViewer = cache(async (): Promise<Viewer | null> => {
  // The session is per-request by definition, and token validation reads the
  // clock (expiry), which Cache Components forbids during (runtime) prerenders.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
});

export const getViewerProfile = cache(async (): Promise<ViewerProfile | null> => {
  const viewer = await getViewer();
  if (!viewer) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_path, bio, onboarded_at, role, suspended_at")
    .eq("id", viewer.id)
    .maybeSingle();
  return data;
});

/** Redirects to /login (returning to `next`) when signed out. */
export async function requireViewer(next?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return viewer;
}

/**
 * For pages that need a fully set-up account: signed in AND onboarded.
 * Unfinished accounts are sent to onboarding first.
 */
export async function requireOnboardedProfile(next?: string) {
  await requireViewer(next);
  const profile = await getViewerProfile();
  if (!profile?.username || !profile.onboarded_at) redirect("/onboarding");
  return profile as ViewerProfile & { username: string };
}
