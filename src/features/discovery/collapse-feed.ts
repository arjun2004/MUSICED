import type { FeedItem } from "@/types/domain";

/** Listening actions that describe one sitting with an album. */
const LISTENING = new Set<FeedItem["type"]>(["logged", "rated", "reviewed"]);

/** Actions by the same person on the same album this close together are one moment. */
const WINDOW_MS = 30 * 60 * 1000;

/**
 * Collapses "listened to" + "rated" + "reviewed" by the same listener on the
 * same album (within 30 minutes) into a single feed entry. A listen with a
 * rating and a review is one thing to the reader, not three.
 *
 * Input must be newest-first (as returned by the feed queries).
 */
export function collapseFeed(items: FeedItem[]): FeedItem[] {
  const out: FeedItem[] = [];
  // Index of the merged entry per actor+album, for entries still within the window.
  const open = new Map<string, number>();

  for (const item of items) {
    if (!LISTENING.has(item.type) || !item.album) {
      out.push({ ...item, actions: [item.type] });
      continue;
    }

    const key = `${item.actor.id}:${item.album.id}`;
    const index = open.get(key);
    const target = index === undefined ? undefined : out[index];

    if (
      target &&
      Date.parse(target.created_at) - Date.parse(item.created_at) <= WINDOW_MS &&
      !target.actions?.includes(item.type)
    ) {
      target.actions = [...(target.actions ?? [target.type]), item.type];
      target.review = target.review ?? item.review;
      // The review's rating, then the diary entry's, then the bare rating.
      target.rating = pickRating(target, item);
      target.type = primaryType(target.actions);
      continue;
    }

    out.push({ ...item, actions: [item.type] });
    open.set(key, out.length - 1);
  }

  return out;
}

function primaryType(actions: FeedItem["type"][]): FeedItem["type"] {
  if (actions.includes("reviewed")) return "reviewed";
  if (actions.includes("logged")) return "logged";
  return actions[0];
}

/** A review's stars win; otherwise keep whichever rating is present. */
function pickRating(target: FeedItem, item: FeedItem): number | null {
  if (item.type === "reviewed" && item.rating !== null) return item.rating;
  return target.rating ?? item.rating;
}
