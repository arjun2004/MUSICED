import type { Enums } from "./database";

/** Lightweight shapes passed from data-access functions to UI components. */

export type Visibility = Enums<"visibility">;

export type ProfileSummary = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_path: string | null;
};

export type AlbumSummary = {
  id: string;
  slug: string;
  title: string;
  artist_credit: string;
  release_year: number | null;
  cover_url: string | null;
  album_type?: Enums<"album_type">;
};

export type AlbumWithStats = AlbumSummary & {
  average_rating: number | null;
  ratings_count: number;
};

export type ReviewCard = {
  id: string;
  title: string | null;
  body: string;
  rating: number | null;
  contains_spoilers: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author: ProfileSummary;
  album: AlbumSummary;
};

export type FeedItem = {
  id: string;
  type: Enums<"activity_type">;
  /** Every action merged into this entry (see collapseFeed), e.g. ["logged", "rated"]. */
  actions?: Enums<"activity_type">[];
  created_at: string;
  rating: number | null;
  actor: ProfileSummary;
  album: AlbumSummary | null;
  subject: ProfileSummary | null;
  review: { id: string; title: string | null; body: string; contains_spoilers: boolean } | null;
  list: { id: string; title: string; items_count: number } | null;
};
