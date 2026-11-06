import type { BrowseFilters, BrowseSort } from "./queries";

export const SORTS: { value: BrowseSort; label: string; hint: string }[] = [
  { value: "top", label: "Top rated", hint: "Weighted average — small samples count less" },
  { value: "popular", label: "Popular", hint: "Most ratings and listens" },
  { value: "trending", label: "Trending", hint: "Most activity in the last 7 days" },
  { value: "new", label: "New releases", hint: "Newest release dates" },
  { value: "recent", label: "Recently added", hint: "Newest to MUSICED" },
];

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Parse and sanitise Explore/Charts query params. */
export function parseBrowseParams(params: Params, defaultSort: BrowseSort = "top"): Required<Pick<BrowseFilters, "sort" | "page">> & BrowseFilters {
  const sortRaw = one(params.sort);
  const sort = SORTS.some((s) => s.value === sortRaw) ? (sortRaw as BrowseSort) : defaultSort;
  const genre = one(params.genre);
  const decade = Number(one(params.decade));
  const year = Number(one(params.year));
  const country = one(params.country);
  const page = Number(one(params.page));
  return {
    sort,
    genre: genre && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(genre) ? genre : undefined,
    decade: Number.isInteger(decade) && decade >= 1900 && decade <= 2100 && decade % 10 === 0 ? decade : undefined,
    year: Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : undefined,
    country: country && /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : undefined,
    page: Number.isInteger(page) && page > 0 && page < 500 ? page : 1,
  };
}

/** Build a URL with one filter changed (and page reset). */
export function browseHref(base: string, current: BrowseFilters, change: Partial<BrowseFilters>) {
  const next = { ...current, page: undefined, ...change };
  const q = new URLSearchParams();
  if (next.sort) q.set("sort", next.sort);
  if (next.genre) q.set("genre", next.genre);
  if (next.decade) q.set("decade", String(next.decade));
  if (next.year) q.set("year", String(next.year));
  if (next.country) q.set("country", next.country);
  if (next.page && next.page > 1) q.set("page", String(next.page));
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
export function countryName(code: string) {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}
