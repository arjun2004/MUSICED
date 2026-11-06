import "server-only";

import { serverEnv } from "@/lib/env.server";
import type { Enums } from "@/types/database";
import { checkReleaseGroupCover, releaseGroupCoverUrl } from "./cover-art-archive";
import { partialDate, slugify } from "./slug";
import {
  ProviderError,
  type MusicProvider,
  type ProviderAlbum,
  type ProviderAlbumHit,
  type ProviderArtist,
  type ProviderArtistHit,
  type ProviderTrack,
} from "./types";

/**
 * MusicBrainz Web Service v2 (https://musicbrainz.org/doc/MusicBrainz_API).
 * Rules we honour: a meaningful User-Agent, ≤ 1 request/second, back off on 503.
 *
 * The throttle is per server instance. On multi-instance deployments the
 * provider_cache and catalog-first search keep real traffic far below the limit;
 * a shared queue (e.g. Redis) is the upgrade path if that changes.
 */
const BASE = "https://musicbrainz.org/ws/2";
const MIN_INTERVAL_MS = 1100;

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function mbFetch<T>(path: string): Promise<T> {
  const { musicbrainzUserAgent } = serverEnv();
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}fmt=json`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await schedule(() =>
      fetch(url, {
        headers: { "User-Agent": musicbrainzUserAgent, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      }),
    ).catch((err: unknown) => {
      throw new ProviderError(`MusicBrainz unreachable: ${(err as Error).message}`);
    });

    if (res.status === 503 || res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (res.status === 404) throw new ProviderError("Not found on MusicBrainz", 404);
    if (!res.ok) throw new ProviderError(`MusicBrainz error ${res.status}`, res.status);
    return (await res.json()) as T;
  }
  throw new ProviderError("MusicBrainz is busy right now. Try again in a moment.", 503);
}

/* ------------------------------------------------------------------------ */
/* Response shapes (only the fields we read)                                  */
/* ------------------------------------------------------------------------ */

type MbArtistCredit = {
  name: string;
  joinphrase?: string;
  artist: {
    id: string;
    name: string;
    "sort-name"?: string;
    disambiguation?: string;
    type?: string | null;
    country?: string | null;
  };
};

type MbReleaseGroup = {
  id: string;
  title: string;
  "primary-type"?: string | null;
  "secondary-types"?: string[];
  "first-release-date"?: string;
  "artist-credit"?: MbArtistCredit[];
  genres?: { name: string; count: number }[];
  releases?: { id: string; status?: string; date?: string; country?: string }[];
};

type MbRelease = {
  id: string;
  country?: string | null;
  "label-info"?: { label?: { name: string } | null }[];
  media?: {
    position?: number;
    tracks?: { position: number; number?: string; title: string; length?: number | null; recording?: { id: string } }[];
  }[];
};

/* ------------------------------------------------------------------------ */
/* Mapping                                                                    */
/* ------------------------------------------------------------------------ */

export function mapAlbumType(primary?: string | null, secondary: string[] = []): Enums<"album_type"> {
  const s = secondary.map((t) => t.toLowerCase());
  if (s.includes("compilation")) return "compilation";
  if (s.includes("live")) return "live";
  if (s.includes("soundtrack")) return "soundtrack";
  if (s.includes("remix")) return "remix";
  if (s.includes("mixtape/street")) return "mixtape";
  switch ((primary ?? "").toLowerCase()) {
    case "album":
      return "album";
    case "ep":
      return "ep";
    case "single":
      return "single";
    case "broadcast":
      return "broadcast";
    default:
      return "other";
  }
}

export function creditText(credits: MbArtistCredit[] = []) {
  return credits.map((c) => `${c.name}${c.joinphrase ?? ""}`).join("").trim() || "Unknown artist";
}

const isCountry = (value: unknown): value is string => typeof value === "string" && /^[A-Z]{2}$/.test(value);

/** Earliest official release, falling back to the earliest of any status. */
export function pickRepresentativeRelease(releases: MbReleaseGroup["releases"] = []) {
  const byDate = [...releases].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  return byDate.find((r) => r.status === "Official") ?? byDate[0] ?? null;
}

export function mapTracks(release: MbRelease | null): ProviderTrack[] {
  const tracks: ProviderTrack[] = [];
  for (const medium of release?.media ?? []) {
    for (const t of medium.tracks ?? []) {
      if (!t.title || !Number.isInteger(t.position) || t.position < 1) continue;
      tracks.push({
        discNumber: medium.position && medium.position > 0 ? medium.position : 1,
        position: t.position,
        number: t.number ?? null,
        title: t.title,
        durationMs: typeof t.length === "number" && t.length >= 0 ? t.length : null,
        recordingId: t.recording?.id ?? null,
      });
    }
  }
  return tracks;
}

type MbArtist = {
  id: string;
  name: string;
  "sort-name"?: string;
  disambiguation?: string;
  type?: string | null;
  country?: string | null;
  score?: number;
  "life-span"?: { begin?: string | null; end?: string | null };
};

function mapArtist(a: MbArtist): ProviderArtist {
  return {
    provider: "musicbrainz",
    externalId: a.id,
    url: `https://musicbrainz.org/artist/${a.id}`,
    name: a.name,
    sortName: a["sort-name"] ?? null,
    disambiguation: a.disambiguation || null,
    artistType: a.type ? a.type.toLowerCase() : null,
    country: isCountry(a.country) ? a.country : null,
    beginDate: partialDate(a["life-span"]?.begin),
    endDate: partialDate(a["life-span"]?.end),
    slugBase: slugify(a.name) || `artist-${a.id.slice(0, 8)}`,
  };
}

/* ------------------------------------------------------------------------ */
/* Provider                                                                   */
/* ------------------------------------------------------------------------ */

export const musicBrainz: MusicProvider = {
  id: "musicbrainz",

  async searchAlbums(query, limit) {
    const q = encodeURIComponent(query.trim().slice(0, 120));
    const data = await mbFetch<{ "release-groups"?: (MbReleaseGroup & { score?: number })[] }>(
      `/release-group/?query=${q}&dismax=true&limit=${Math.min(Math.max(limit, 1), 25)}`,
    );
    const groups = (data["release-groups"] ?? []).filter((rg) => (rg.score ?? 0) >= 50);

    const { musicbrainzUserAgent } = serverEnv();
    const covers = await Promise.all(groups.map((rg) => checkReleaseGroupCover(rg.id, musicbrainzUserAgent, 3000)));

    return groups.map<ProviderAlbumHit>((rg, i) => {
      const date = partialDate(rg["first-release-date"]);
      return {
        provider: "musicbrainz",
        externalId: rg.id,
        title: rg.title,
        artistCredit: creditText(rg["artist-credit"]),
        albumType: mapAlbumType(rg["primary-type"], rg["secondary-types"]),
        releaseYear: date ? Number(date.slice(0, 4)) : null,
        coverUrl: covers[i] === "available" ? releaseGroupCoverUrl(rg.id, 250) : null,
      };
    });
  },

  async searchArtists(query, limit) {
    const q = encodeURIComponent(query.trim().slice(0, 120));
    const data = await mbFetch<{ artists?: MbArtist[] }>(
      `/artist/?query=${q}&dismax=true&limit=${Math.min(Math.max(limit, 1), 25)}`,
    );
    return (data.artists ?? [])
      .filter((a) => (a.score ?? 0) >= 60)
      .map<ProviderArtistHit>((a) => {
        const m = mapArtist(a);
        return {
          provider: m.provider,
          externalId: m.externalId,
          name: m.name,
          disambiguation: m.disambiguation,
          country: m.country,
          artistType: m.artistType,
        };
      });
  },

  async getArtist(externalId) {
    if (!/^[0-9a-f-]{36}$/i.test(externalId)) return null;
    try {
      return mapArtist(await mbFetch<MbArtist>(`/artist/${externalId}`));
    } catch (err) {
      if (err instanceof ProviderError && err.status === 404) return null;
      throw err;
    }
  },

  async getDiscography(externalId, limit) {
    if (!/^[0-9a-f-]{36}$/i.test(externalId)) return [];
    const data = await mbFetch<{ "release-groups"?: MbReleaseGroup[] }>(
      `/release-group?artist=${externalId}&type=album%7Cep&inc=artist-credits&limit=${Math.min(limit, 100)}`,
    );
    const groups = (data["release-groups"] ?? [])
      // Studio work first: drop compilations, live albums, remixes, demos.
      .filter((rg) => !(rg["secondary-types"] ?? []).some((t) => /compilation|live|remix|demo|dj-mix|interview/i.test(t)))
      .sort((a, b) => (a["first-release-date"] || "9999").localeCompare(b["first-release-date"] || "9999"));

    const { musicbrainzUserAgent } = serverEnv();
    const covers = await Promise.all(groups.map((rg) => checkReleaseGroupCover(rg.id, musicbrainzUserAgent, 3000)));
    return groups.map((rg, i) => {
      const date = partialDate(rg["first-release-date"]);
      return {
        provider: "musicbrainz" as const,
        externalId: rg.id,
        title: rg.title,
        artistCredit: creditText(rg["artist-credit"]),
        albumType: mapAlbumType(rg["primary-type"], rg["secondary-types"]),
        releaseYear: date ? Number(date.slice(0, 4)) : null,
        coverUrl: covers[i] === "available" ? releaseGroupCoverUrl(rg.id, 250) : null,
      };
    });
  },

  async getAlbum(externalId) {
    if (!/^[0-9a-f-]{36}$/i.test(externalId)) return null;
    let rg: MbReleaseGroup;
    try {
      rg = await mbFetch<MbReleaseGroup>(`/release-group/${externalId}?inc=artist-credits+genres+releases`);
    } catch (err) {
      if (err instanceof ProviderError && err.status === 404) return null;
      throw err;
    }

    const representative = pickRepresentativeRelease(rg.releases);
    const { musicbrainzUserAgent } = serverEnv();
    const [release, cover] = await Promise.all([
      representative
        ? mbFetch<MbRelease>(`/release/${representative.id}?inc=recordings+labels`).catch(() => null)
        : Promise.resolve(null),
      checkReleaseGroupCover(rg.id, musicbrainzUserAgent),
    ]);

    const credits = rg["artist-credit"] ?? [];
    const credit = creditText(credits);
    const date = partialDate(rg["first-release-date"]);

    return {
      provider: "musicbrainz",
      externalId: rg.id,
      url: `https://musicbrainz.org/release-group/${rg.id}`,
      releaseExternalId: release?.id ?? null,
      releaseUrl: release ? `https://musicbrainz.org/release/${release.id}` : null,
      title: rg.title,
      artistCredit: credit,
      albumType: mapAlbumType(rg["primary-type"], rg["secondary-types"]),
      secondaryTypes: rg["secondary-types"] ?? [],
      releaseDate: date,
      releaseYear: date ? Number(date.slice(0, 4)) : null,
      label: release?.["label-info"]?.find((l) => l.label?.name)?.label?.name ?? null,
      country: isCountry(release?.country) ? release!.country! : null,
      coverUrl: cover === "missing" ? null : releaseGroupCoverUrl(rg.id, 500),
      coverStatus: cover,
      slugBase: slugify(`${credit} ${rg.title}`) || `album-${rg.id.slice(0, 8)}`,
      artists: credits.map((c) => ({
        externalId: c.artist.id,
        url: `https://musicbrainz.org/artist/${c.artist.id}`,
        name: c.artist.name,
        sortName: c.artist["sort-name"] ?? null,
        disambiguation: c.artist.disambiguation || null,
        artistType: c.artist.type ? c.artist.type.toLowerCase() : null,
        country: isCountry(c.artist.country) ? c.artist.country : null,
        creditedName: c.name,
        joinPhrase: c.joinphrase ?? "",
        slugBase: slugify(c.artist.name) || `artist-${c.artist.id.slice(0, 8)}`,
      })),
      tracks: mapTracks(release),
      genres: (rg.genres ?? [])
        .filter((g) => g.count > 0 && slugify(g.name))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
        .map((g) => ({ slug: slugify(g.name, 80), name: g.name.replace(/\b\w/g, (ch) => ch.toUpperCase()), weight: g.count })),
    } satisfies ProviderAlbum;
  },
};
