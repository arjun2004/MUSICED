import { publicEnv } from "@/lib/env";

export const AVATAR_BUCKET = "avatars";
export const LIST_COVER_BUCKET = "list-covers";

/**
 * Builds the public URL for an object in a public bucket without a network
 * round-trip. Paths are always `<user-id>/<file>` (enforced in the schema).
 */
export function publicStorageUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  const base = publicEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}

export function avatarUrl(path: string | null | undefined) {
  return publicStorageUrl(AVATAR_BUCKET, path);
}
