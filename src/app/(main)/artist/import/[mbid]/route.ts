import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { checkRateLimit, clientFingerprint } from "@/lib/rate-limit";
import { CatalogImportError, findArtistByExternalId, importArtist } from "@/features/catalog/service";

/** Open a MusicBrainz artist: import if needed, then go to the artist page. */
export async function GET(request: NextRequest, ctx: RouteContext<"/artist/import/[mbid]">) {
  const { mbid } = await ctx.params;
  const { origin } = request.nextUrl;
  if (!z.uuid().safeParse(mbid).success) return NextResponse.redirect(`${origin}/search?type=artists`);

  const existing = await findArtistByExternalId(mbid);
  if (existing) return NextResponse.redirect(`${origin}/artist/${existing.slug}`);

  const viewer = await getViewer();
  const limit = await checkRateLimit("catalogImport", viewer?.id ?? (await clientFingerprint()));
  if (!limit.allowed) {
    return NextResponse.redirect(`${origin}/search?type=artists&error=${encodeURIComponent("Too many new artists opened recently. Try again soon.")}`);
  }
  try {
    const artist = await importArtist(mbid);
    return NextResponse.redirect(`${origin}/artist/${artist.slug}`);
  } catch (err) {
    const message = err instanceof CatalogImportError ? err.message : "Couldn't open that artist.";
    return NextResponse.redirect(`${origin}/search?type=artists&error=${encodeURIComponent(message)}`);
  }
}
