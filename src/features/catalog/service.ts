import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { assertQuery } from "@/lib/supabase/errors";
import { musicBrainz } from "@/lib/music-providers/musicbrainz";
import {
  ProviderError,
  type ProviderAlbum,
  type ProviderAlbumHit,
  type ProviderArtist,
  type ProviderArtistHit,
} from "@/lib/music-providers/types";
import type { AlbumSummary } from "@/types/domain";

/** Only one provider today; the catalog layer is written against the interface. */
const provider = musicBrainz;

const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type CatalogSearchResult = {
  /** Albums already in MUSICED (have pages, ratings, etc.). */
  local: AlbumSummary[];
  /** Matches from MusicBrainz not yet in MUSICED; opening one imports it. */
  remote: ProviderAlbumHit[];
  /** Set when the external provider could not be reached. */
  remoteError?: string;
};

export function normaliseQuery(query: string) {
  return query.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 120);
}

/** Local catalog search (trigram, every word must match). */
export async function searchLocalAlbums(query: string, limit = 12): Promise<AlbumSummary[]> {
  const q = normaliseQuery(query);
  if (q.length < 2) return [];
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("search_albums", { p_query: q, p_limit: limit });
  assertQuery(error, "search results");
  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    artist_credit: row.artist_credit,
    release_year: row.release_year,
    cover_url: row.cover_url,
    album_type: row.album_type,
  }));
}

/**
 * Catalog-first search. MusicBrainz is consulted only when local results are
 * thin, and its responses are cached for a day in provider_cache.
 */
export async function searchCatalog(
  query: string,
  { limit = 12, includeRemote = true }: { limit?: number; includeRemote?: boolean } = {},
): Promise<CatalogSearchResult> {
  const q = normaliseQuery(query);
  if (q.length < 2) return { local: [], remote: [] };

  const local = await searchLocalAlbums(q, limit);
  if (!includeRemote || local.length >= limit) return { local, remote: [] };

  try {
    const hits = await cachedRemoteSearch(q, limit);
    const known = await knownExternalIds(hits.map((h) => h.externalId));
    return { local, remote: hits.filter((h) => !known.has(h.externalId)) };
  } catch (err) {
    console.error("[catalog] remote search failed:", (err as Error).message);
    return {
      local,
      remote: [],
      remoteError: "MusicBrainz is unavailable right now, so only albums already on MUSICED are shown.",
    };
  }
}

async function cachedRemoteSearch(q: string, limit: number): Promise<ProviderAlbumHit[]> {
  const admin = createAdminClient();
  const key = `${provider.id}:rg-search:${limit}:${q.toLowerCase()}`;

  if (admin) {
    const { data } = await admin
      .from("provider_cache")
      .select("payload, expires_at")
      .eq("cache_key", key)
      .maybeSingle();
    if (data && Date.parse(data.expires_at) > Date.now()) return data.payload as ProviderAlbumHit[];
  }

  const hits = await provider.searchAlbums(q, limit);

  if (admin) {
    await admin.from("provider_cache").upsert({
      cache_key: key,
      provider: provider.id,
      payload: hits,
      expires_at: new Date(Date.now() + SEARCH_CACHE_TTL_MS).toISOString(),
    });
  }
  return hits;
}

async function knownExternalIds(ids: string[]) {
  if (ids.length === 0) return new Set<string>();
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("catalog_sources")
    .select("external_id")
    .eq("provider", provider.id)
    .eq("entity_type", "album")
    .in("external_id", ids);
  return new Set((data ?? []).map((row) => row.external_id));
}

/** Local album for an external id, if it has been imported. */
export async function findAlbumByExternalId(externalId: string) {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("catalog_sources")
    .select("entity_id")
    .eq("provider", provider.id)
    .eq("entity_type", "album")
    .eq("external_id", externalId)
    .maybeSingle();
  if (!data) return null;
  const { data: album } = await supabase.from("albums").select("id, slug").eq("id", data.entity_id).maybeSingle();
  return album;
}

export class CatalogImportError extends Error {}

/**
 * Imports an album from the provider into the catalog (idempotent).
 * Returns the local album's id and slug.
 */
export async function importAlbum(externalId: string): Promise<{ id: string; slug: string }> {
  const existing = await findAlbumByExternalId(externalId);
  if (existing) return existing;

  const admin = createAdminClient();
  if (!admin) {
    throw new CatalogImportError(
      "Importing albums requires SUPABASE_SECRET_KEY to be configured on the server.",
    );
  }

  let album: ProviderAlbum | null;
  try {
    album = await provider.getAlbum(externalId);
  } catch (err) {
    throw new CatalogImportError(
      err instanceof ProviderError ? err.message : "Couldn't reach MusicBrainz. Please try again.",
    );
  }
  if (!album) throw new CatalogImportError("That album wasn't found on MusicBrainz.");

  const { data: id, error } = await admin.rpc("ingest_album", { p: toIngestPayload(album) });
  if (error || !id) {
    console.error("[catalog] ingest failed", error?.code, error?.message);
    throw new CatalogImportError(importFailureMessage(error, "album"));
  }

  const { data: row } = await admin.from("albums").select("id, slug").eq("id", id).single();
  if (!row) throw new CatalogImportError("We couldn't add that album to MUSICED. Please try again.");
  return row;
}

/** Maps the provider-neutral album to the ingest_album() JSON contract. */
export function toIngestPayload(album: ProviderAlbum) {
  return {
    provider: album.provider,
    external_id: album.externalId,
    url: album.url,
    release_external_id: album.releaseExternalId,
    release_url: album.releaseUrl,
    title: album.title,
    artist_credit: album.artistCredit,
    album_type: album.albumType,
    secondary_types: album.secondaryTypes,
    release_date: album.releaseDate,
    release_year: album.releaseYear,
    label: album.label,
    country: album.country,
    cover_url: album.coverUrl,
    cover_status: album.coverStatus,
    slug_base: album.slugBase,
    artists: album.artists.map((a) => ({
      external_id: a.externalId,
      url: a.url,
      name: a.name,
      sort_name: a.sortName,
      disambiguation: a.disambiguation,
      artist_type: a.artistType,
      country: a.country,
      credited_name: a.creditedName,
      join_phrase: a.joinPhrase,
      slug_base: a.slugBase,
    })),
    tracks: album.tracks.map((t) => ({
      disc_number: t.discNumber,
      position: t.position,
      number: t.number,
      title: t.title,
      duration_ms: t.durationMs,
      recording_mbid: t.recordingId,
    })),
    genres: album.genres,
  };
}

/* -------------------------------------------------------------------------- */
/* Artists                                                                      */
/* -------------------------------------------------------------------------- */

/** Read-through cache in provider_cache (service role). Falls back to live calls without a secret key. */
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin.from("provider_cache").select("payload, expires_at").eq("cache_key", key).maybeSingle();
    if (data && Date.parse(data.expires_at) > Date.now()) return data.payload as T;
  }
  const value = await load();
  if (admin) {
    await admin.from("provider_cache").upsert({
      cache_key: key,
      provider: provider.id,
      payload: value as never,
      expires_at: new Date(Date.now() + ttlMs).toISOString(),
    });
  }
  return value;
}

export type ArtistSummary = {
  id: string;
  slug: string;
  name: string;
  disambiguation: string | null;
  country: string | null;
  artist_type: string | null;
};

export type ArtistSearchResult = {
  local: ArtistSummary[];
  remote: ProviderArtistHit[];
  remoteError?: string;
};

export async function searchArtistsCatalog(query: string, limit = 8): Promise<ArtistSearchResult> {
  const q = normaliseQuery(query);
  if (q.length < 2) return { local: [], remote: [] };
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("search_artists", { p_query: q, p_limit: limit });
  assertQuery(error, "artists");
  const local = (data ?? []) as ArtistSummary[];
  if (local.length >= limit) return { local, remote: [] };

  try {
    const hits = await cached(`${provider.id}:artist-search:${limit}:${q.toLowerCase()}`, SEARCH_CACHE_TTL_MS, () =>
      provider.searchArtists(q, limit),
    );
    const known = await knownIds("artist", hits.map((h) => h.externalId));
    return { local, remote: hits.filter((h) => !known.has(h.externalId)) };
  } catch (err) {
    console.error("[catalog] artist search failed:", (err as Error).message);
    return { local, remote: [], remoteError: "MusicBrainz is unavailable right now." };
  }
}

async function knownIds(entityType: "album" | "artist", ids: string[]) {
  if (ids.length === 0) return new Set<string>();
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("catalog_sources")
    .select("external_id")
    .eq("provider", provider.id)
    .eq("entity_type", entityType)
    .in("external_id", ids);
  return new Set((data ?? []).map((row) => row.external_id));
}

export async function findArtistByExternalId(externalId: string) {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("catalog_sources")
    .select("entity_id")
    .eq("provider", provider.id)
    .eq("entity_type", "artist")
    .eq("external_id", externalId)
    .maybeSingle();
  if (!data) return null;
  const { data: artist } = await supabase.from("artists").select("id, slug").eq("id", data.entity_id).maybeSingle();
  return artist;
}

/** Imports (or enriches) an artist from the provider. Idempotent. */
export async function importArtist(externalId: string): Promise<{ id: string; slug: string }> {
  const admin = createAdminClient();
  if (!admin) throw new CatalogImportError("Importing artists requires SUPABASE_SECRET_KEY on the server.");

  let artist: ProviderArtist | null;
  try {
    artist = await provider.getArtist(externalId);
  } catch (err) {
    throw new CatalogImportError(err instanceof ProviderError ? err.message : "Couldn't reach MusicBrainz.");
  }
  if (!artist) throw new CatalogImportError("That artist wasn't found on MusicBrainz.");

  const { data: id, error } = await admin.rpc("ingest_artist", {
    p: {
      provider: artist.provider,
      external_id: artist.externalId,
      url: artist.url,
      name: artist.name,
      sort_name: artist.sortName,
      disambiguation: artist.disambiguation,
      artist_type: artist.artistType,
      country: artist.country,
      begin_date: artist.beginDate,
      end_date: artist.endDate,
      slug_base: artist.slugBase,
    },
  });
  if (error || !id) {
    console.error("[catalog] artist ingest failed", error?.code, error?.message);
    throw new CatalogImportError(importFailureMessage(error, "artist"));
  }
  const { data: row } = await admin.from("artists").select("id, slug").eq("id", id).single();
  if (!row) throw new CatalogImportError("We couldn't add that artist. Please try again.");
  return row;
}

/** Artist discography from the provider, cached for a week. */
export async function getProviderDiscography(externalId: string) {
  return cached(`${provider.id}:discography:${externalId}`, 7 * SEARCH_CACHE_TTL_MS, () =>
    provider.getDiscography(externalId, 100),
  );
}

/**
 * A rejected service key (wrong project, local demo key, or the publishable key
 * pasted by mistake) is a deployment problem, not a transient one — say so.
 */
function importFailureMessage(error: { code?: string; message?: string } | null, kind: "album" | "artist") {
  const msg = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (/invalid api key|jwt|401|42501|permission denied|pgrst30/.test(msg)) {
    console.error(
      "[catalog] SUPABASE_SECRET_KEY was rejected by Supabase. Set it to this project's secret key (Project Settings → API Keys) and redeploy.",
    );
    return `Adding new ${kind}s is temporarily unavailable (server configuration). Please try again later.`;
  }
  return kind === "album" ? "We couldn't add that album to MUSICED. Please try again." : "We couldn't add that artist. Please try again.";
}
