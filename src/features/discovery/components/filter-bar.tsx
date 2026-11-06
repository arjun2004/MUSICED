import Link from "next/link";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrowseFilters } from "@/features/discovery/queries";
import type { ExploreFacets } from "@/features/discovery/queries";
import { SORTS, browseHref, countryName } from "@/features/discovery/browse-params";

/**
 * Server-rendered filters: every option is a plain link, so filtering works
 * without JavaScript, is shareable, and is keyboard accessible.
 */
export function FilterBar({
  base,
  filters,
  facets,
  showSort = true,
}: {
  base: string;
  filters: BrowseFilters;
  facets: ExploreFacets;
  showSort?: boolean;
}) {
  const genreName = facets.genres.find((g) => g.slug === filters.genre)?.name;
  const active = [
    filters.genre ? { label: genreName ?? filters.genre, clear: { genre: undefined } } : null,
    filters.decade ? { label: `${filters.decade}s`, clear: { decade: undefined } } : null,
    filters.year ? { label: String(filters.year), clear: { year: undefined } } : null,
    filters.country ? { label: countryName(filters.country), clear: { country: undefined } } : null,
  ].filter(Boolean) as { label: string; clear: Partial<BrowseFilters> }[];

  // Years within the chosen decade that actually have albums would need another
  // query; listing the decade's ten years is cheap and the empty state handles misses.
  const years = filters.decade ? Array.from({ length: 10 }, (_, i) => filters.decade! + 9 - i) : [];

  return (
    <div className="grid gap-4">
      {showSort ? (
        <nav aria-label="Sort" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
          {SORTS.map((s) => (
            <Link
              key={s.value}
              href={browseHref(base, filters, { sort: s.value })}
              aria-current={filters.sort === s.value ? "page" : undefined}
              title={s.hint}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors",
                filters.sort === s.value ? "bg-foreground font-medium text-background" : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Menu label={genreName ?? "Genre"} active={Boolean(filters.genre)}>
          {facets.genres.map((g) => (
            <MenuLink key={g.slug} href={browseHref(base, filters, { genre: g.slug })} active={filters.genre === g.slug} count={g.albums}>
              {g.name}
            </MenuLink>
          ))}
        </Menu>
        <Menu label={filters.decade ? `${filters.decade}s` : "Decade"} active={Boolean(filters.decade)}>
          {facets.decades.map((d) => (
            <MenuLink
              key={d.decade}
              href={browseHref(base, filters, { decade: d.decade, year: undefined })}
              active={filters.decade === d.decade}
              count={d.albums}
            >
              {d.decade}s
            </MenuLink>
          ))}
        </Menu>
        {years.length ? (
          <Menu label={filters.year ? String(filters.year) : "Year"} active={Boolean(filters.year)}>
            {years.map((y) => (
              <MenuLink key={y} href={browseHref(base, filters, { year: y })} active={filters.year === y}>
                {y}
              </MenuLink>
            ))}
          </Menu>
        ) : null}
        {facets.countries.length ? (
          <Menu label={filters.country ? countryName(filters.country) : "Country"} active={Boolean(filters.country)}>
            {facets.countries.map((c) => (
              <MenuLink key={c.country} href={browseHref(base, filters, { country: c.country })} active={filters.country === c.country} count={c.albums}>
                {countryName(c.country)}
              </MenuLink>
            ))}
          </Menu>
        ) : null}

        {active.map((chip) => (
          <Link
            key={chip.label}
            href={browseHref(base, filters, chip.clear)}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-signal/10 px-3 text-xs font-medium text-signal hover:bg-signal/20"
            aria-label={`Remove filter ${chip.label}`}
          >
            {chip.label} <X className="size-3" aria-hidden="true" />
          </Link>
        ))}
        {active.length > 1 ? (
          <Link href={browseHref(base, { sort: filters.sort }, {})} className="text-xs text-muted-foreground hover:text-foreground">
            Clear all
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function Menu({ label, active, children }: { label: string; active: boolean; children: React.ReactNode }) {
  return (
    <details className="group relative">
      <summary
        className={cn(
          "inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-full border px-3 text-sm transition-colors [&::-webkit-details-marker]:hidden",
          active ? "border-signal/40 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="absolute top-10 left-0 z-30 max-h-80 w-56 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-xl">
        {children}
      </div>
    </details>
  );
}

function MenuLink({ href, active, count, children }: { href: string; active: boolean; count?: number; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex items-center justify-between rounded px-2.5 py-1.5 text-sm hover:bg-surface",
        active ? "text-signal" : "text-foreground/90",
      )}
    >
      <span className="truncate">{children}</span>
      {count !== undefined ? <span className="font-mono text-[0.6875rem] text-muted-foreground">{count}</span> : null}
    </Link>
  );
}
