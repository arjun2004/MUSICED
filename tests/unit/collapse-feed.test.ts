import { describe, expect, it } from "vitest";
import { collapseFeed } from "@/features/discovery/collapse-feed";
import type { FeedItem } from "@/types/domain";

const ava = { id: "u-ava", username: "ava", display_name: "Ava", avatar_path: null };
const sam = { id: "u-sam", username: "sam", display_name: "Sam", avatar_path: null };
const album = (id: string) => ({
  id,
  slug: id,
  title: id,
  artist_credit: "Artist",
  release_year: 1991,
  cover_url: null,
});

let n = 0;
function item(partial: Partial<FeedItem> & Pick<FeedItem, "type">, minutesAgo: number): FeedItem {
  return {
    id: `a${n++}`,
    created_at: new Date(Date.UTC(2026, 10, 6, 12, 0) - minutesAgo * 60_000).toISOString(),
    rating: null,
    actor: ava,
    album: album("low-end-theory"),
    subject: null,
    review: null,
    list: null,
    ...partial,
  };
}

describe("collapseFeed", () => {
  it("merges a listen and its rating into one entry", () => {
    const feed = collapseFeed([item({ type: "rated", rating: 3 }, 0), item({ type: "logged", rating: 3 }, 0)]);
    expect(feed).toHaveLength(1);
    expect(feed[0].type).toBe("logged");
    expect(feed[0].actions?.sort()).toEqual(["logged", "rated"]);
    expect(feed[0].rating).toBe(3);
  });

  it("folds a rating and listen into a review, keeping the review text and stars", () => {
    const review = { id: "r1", title: null, body: "Bass, how low", contains_spoilers: false };
    const feed = collapseFeed([
      item({ type: "reviewed", rating: 5, review }, 0),
      item({ type: "rated", rating: 4.5 }, 1),
      item({ type: "logged", rating: 4.5 }, 2),
    ]);
    expect(feed).toHaveLength(1);
    expect(feed[0].type).toBe("reviewed");
    expect(feed[0].review?.body).toBe("Bass, how low");
    expect(feed[0].rating).toBe(5);
  });

  it("keeps different albums, different people, and distant re-listens separate", () => {
    const feed = collapseFeed([
      item({ type: "logged" }, 0),
      item({ type: "logged", album: album("loveless") }, 1),
      item({ type: "logged", actor: sam }, 2),
      item({ type: "logged" }, 60 * 24), // the same album a day earlier: a separate listen
    ]);
    expect(feed).toHaveLength(4);
  });

  it("does not merge two listens of the same album into one", () => {
    const feed = collapseFeed([item({ type: "logged" }, 0), item({ type: "logged" }, 5)]);
    expect(feed).toHaveLength(2);
  });

  it("leaves non-listening activity untouched", () => {
    const feed = collapseFeed([
      item({ type: "followed", album: null, subject: sam }, 0),
      item({ type: "created_list", album: null, list: { id: "l1", title: "Top 50", items_count: 50 } }, 0),
    ]);
    expect(feed.map((f) => f.type)).toEqual(["followed", "created_list"]);
  });
});
