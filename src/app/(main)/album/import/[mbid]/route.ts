import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { checkRateLimit, clientFingerprint } from "@/lib/rate-limit";
import { CatalogImportError, findAlbumByExternalId, importAlbum } from "@/features/catalog/service";

/**
 * Opening a MusicBrainz search result: redirect to the album page, importing
 * it first if MUSICED doesn't have it yet. Imports are rate limited per user
 * (or per hashed IP for visitors) to keep MusicBrainz traffic polite.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/album/import/[mbid]">) {
  const { mbid } = await ctx.params;
  const { origin } = request.nextUrl;
  if (!z.uuid().safeParse(mbid).success) return NextResponse.redirect(`${origin}/search`);

  const existing = await findAlbumByExternalId(mbid);
  if (existing) return NextResponse.redirect(`${origin}/album/${existing.slug}`);

  const viewer = await getViewer();
  const limit = await checkRateLimit("catalogImport", viewer?.id ?? (await clientFingerprint()));
  if (!limit.allowed) {
    return NextResponse.redirect(
      `${origin}/search?error=${encodeURIComponent("You've opened a lot of new albums recently. Try again in a bit.")}`,
    );
  }

  try {
    const album = await importAlbum(mbid);
    return NextResponse.redirect(`${origin}/album/${album.slug}`);
  } catch (err) {
    const message = err instanceof CatalogImportError ? err.message : "Couldn't open that album.";
    return NextResponse.redirect(`${origin}/search?error=${encodeURIComponent(message)}`);
  }
}
