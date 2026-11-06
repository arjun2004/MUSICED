import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

/** "4.5" / "4" — ratings shown without trailing zeros. */
export function formatRating(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? `${n}.0` : n.toFixed(1);
}

/** Average with two decimals, e.g. "3.87". */
export function formatAverage(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

/** Compact counts: 950, 1.2K, 34K, 1.1M. */
export function formatCount(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}

/** "3h", "2d" — for activity timestamps. */
export function timeAgo(iso: string): string {
  const date = parseISO(iso);
  if (!isValid(date)) return "";
  return formatDistanceToNowStrict(date, { addSuffix: false })
    .replace(/ seconds?/, "s")
    .replace(/ minutes?/, "m")
    .replace(/ hours?/, "h")
    .replace(/ days?/, "d")
    .replace(/ months?/, "mo")
    .replace(/ years?/, "y");
}

/** "Joined March 2026" style. */
export function formatMonthYear(iso: string): string {
  const date = parseISO(iso);
  return isValid(date) ? format(date, "MMMM yyyy") : "";
}

/**
 * MusicBrainz partial dates: "2007", "2007-10", "2007-10-10".
 * Renders as precisely as the data allows.
 */
export function formatPartialDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  if (!m) return y;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, d ? Number(d) : 1));
  if (Number.isNaN(date.getTime())) return y;
  return d
    ? format(date, "d MMMM yyyy")
    : format(date, "MMMM yyyy");
}

/** 245000 → "4:05"; 4000000 → "1:06:40". */
export function formatDuration(ms: number | null | undefined): string | null {
  if (!ms || ms < 0) return null;
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/[\s_]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0]?.slice(0, 2) ?? "?";
  return letters.toUpperCase();
}
