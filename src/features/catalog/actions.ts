"use server";

import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { checkRateLimit, clientFingerprint } from "@/lib/rate-limit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { CatalogImportError, importAlbum, searchCatalog, type CatalogSearchResult } from "./service";

const querySchema = z.string().trim().min(2).max(120);
const mbidSchema = z.uuid();

/** Album search for pickers (list editor, favourites). */
export async function searchAlbumsAction(query: string): Promise<ActionResult<CatalogSearchResult>> {
  const parsed = querySchema.safeParse(query);
  if (!parsed.success) return ok({ local: [], remote: [] });

  const viewer = await getViewer();
  const limit = await checkRateLimit("catalogSearch", viewer?.id ?? (await clientFingerprint()));
  if (!limit.allowed) return fail("You're searching very quickly. Give it a second.");

  return ok(await searchCatalog(parsed.data, { limit: 10 }));
}

/** Imports a MusicBrainz release group (signed-in users only, rate limited). */
export async function importAlbumAction(
  externalId: string,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to add albums.");

  const parsed = mbidSchema.safeParse(externalId);
  if (!parsed.success) return fail("That album id isn't valid.");

  const limit = await checkRateLimit("catalogImport", viewer.id);
  if (!limit.allowed) return fail("You've added a lot of albums recently. Try again in a bit.");

  try {
    return ok(await importAlbum(parsed.data));
  } catch (err) {
    return fail(err instanceof CatalogImportError ? err.message : "Couldn't add that album.");
  }
}
