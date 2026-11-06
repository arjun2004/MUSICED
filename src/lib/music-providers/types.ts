import type { Enums } from "@/types/database";

/**
 * Provider-neutral shapes. Every music metadata source (MusicBrainz today,
 * Discogs/Last.fm later) maps its responses into these, and the catalog layer
 * only ever deals with these.
 */

export type ProviderId = "musicbrainz";

/** A search hit that may or may not exist in the local catalog yet. */
export type ProviderAlbumHit = {
  provider: ProviderId;
  externalId: string;
  title: string;
  artistCredit: string;
  albumType: Enums<"album_type">;
  releaseYear: number | null;
  coverUrl: string | null;
};

export type ProviderArtistCredit = {
  externalId: string;
  url: string | null;
  name: string;
  sortName: string | null;
  disambiguation: string | null;
  artistType: string | null;
  country: string | null;
  creditedName: string;
  joinPhrase: string;
  slugBase: string;
};

export type ProviderTrack = {
  discNumber: number;
  position: number;
  number: string | null;
  title: string;
  durationMs: number | null;
  recordingId: string | null;
};

/** Everything needed to create an album in the local catalog. */
export type ProviderAlbum = {
  provider: ProviderId;
  externalId: string;
  url: string;
  releaseExternalId: string | null;
  releaseUrl: string | null;
  title: string;
  artistCredit: string;
  albumType: Enums<"album_type">;
  secondaryTypes: string[];
  releaseDate: string | null;
  releaseYear: number | null;
  label: string | null;
  country: string | null;
  coverUrl: string | null;
  coverStatus: "available" | "missing" | "unknown";
  slugBase: string;
  artists: ProviderArtistCredit[];
  tracks: ProviderTrack[];
  genres: { slug: string; name: string; weight: number }[];
};

export type ProviderArtist = {
  provider: ProviderId;
  externalId: string;
  url: string;
  name: string;
  sortName: string | null;
  disambiguation: string | null;
  artistType: string | null;
  country: string | null;
  beginDate: string | null;
  endDate: string | null;
  slugBase: string;
};

export type ProviderArtistHit = Pick<ProviderArtist, "provider" | "externalId" | "name" | "disambiguation" | "country" | "artistType">;

export interface MusicProvider {
  id: ProviderId;
  /** Free-text album search. */
  searchAlbums(query: string, limit: number): Promise<ProviderAlbumHit[]>;
  /** Free-text artist search. */
  searchArtists(query: string, limit: number): Promise<ProviderArtistHit[]>;
  getArtist(externalId: string): Promise<ProviderArtist | null>;
  /** Albums and EPs credited to the artist (official studio work first). */
  getDiscography(externalId: string, limit: number): Promise<ProviderAlbumHit[]>;
  /** Full album (release group) with credits, representative tracklist, genres, artwork. */
  getAlbum(externalId: string): Promise<ProviderAlbum | null>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
