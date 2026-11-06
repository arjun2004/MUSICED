/**
 * URL slug from any script. Latin text is transliterated (é → e); text that
 * yields nothing (e.g. Hangul, Cyrillic) returns "" so callers can fall back to
 * an id-based slug. Matches the DB constraint ^[a-z0-9]+(-[a-z0-9]+)*$.
 */
export function slugify(text: string, maxLength = 120): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** MusicBrainz partial date, validated: "2007" | "2007-10" | "2007-10-10". */
export function partialDate(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(value) ? value : null;
}
