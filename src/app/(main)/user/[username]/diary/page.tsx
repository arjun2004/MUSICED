import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { EmptyState } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import { getViewer } from "@/lib/auth/session";
import { getProfileByUsername } from "@/features/profile/queries";
import { parsePage } from "@/features/profile/components/follow-list-page";
import { getDiary, getDiaryYears } from "@/features/listening/queries";
import { DiaryList } from "@/features/listening/components/diary-list";

export default function DiaryPage({ params, searchParams }: PageProps<"/user/[username]/diary">) {
  return (
    <Suspense fallback={<ListSkeleton rows={8} />}>
      <Body params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ params, searchParams }: PageProps<"/user/[username]/diary">) {
  const [{ username }, query] = await Promise.all([params, searchParams]);
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const yearParam = Number(typeof query.year === "string" ? query.year : NaN);
  const year = Number.isInteger(yearParam) && yearParam > 1900 && yearParam < 3000 ? yearParam : undefined;
  const page = parsePage(query.page);

  const [viewer, years, diary] = await Promise.all([
    getViewer(),
    getDiaryYears(profile.id),
    getDiary(profile.id, { year, page }),
  ]);
  const isOwner = viewer?.id === profile.id;
  const pages = Math.max(1, Math.ceil(diary.total / diary.pageSize));
  const base = `/user/${profile.username}/diary`;
  const href = (p: number) => `${base}?${new URLSearchParams({ ...(year ? { year: String(year) } : {}), page: String(p) })}`;

  return (
    <div className="max-w-3xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <p className="eyebrow">
          {diary.total} {diary.total === 1 ? "entry" : "entries"}
          {year ? ` in ${year}` : ""}
        </p>
        {years.length > 1 ? (
          <nav aria-label="Filter by year" className="flex flex-wrap gap-1">
            <YearLink href={base} active={!year} label="All" />
            {years.map((y) => (
              <YearLink key={y} href={`${base}?year=${y}`} active={year === y} label={String(y)} />
            ))}
          </nav>
        ) : null}
      </div>

      {diary.entries.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title={isOwner ? "Your diary is empty" : "No diary entries to show"}
          description={isOwner ? "Open any album and press Log to record a listen." : "Entries appear here as they're logged."}
          action={isOwner ? { label: "Find an album", href: "/search" } : undefined}
        />
      ) : (
        <DiaryList key={`${year ?? "all"}-${page}`} entries={diary.entries} isOwner={isOwner} />
      )}

      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-between">
          <Button asChild variant="secondary" size="sm" className={page <= 1 ? "pointer-events-none opacity-40" : ""}>
            <Link href={href(page - 1)}>Newer</Link>
          </Button>
          <span className="font-mono text-xs text-muted-foreground">Page {page} of {pages}</span>
          <Button asChild variant="secondary" size="sm" className={page >= pages ? "pointer-events-none opacity-40" : ""}>
            <Link href={href(page + 1)}>Older</Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

function YearLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full px-3 py-1 font-mono text-xs transition-colors",
        active ? "bg-signal text-signal-foreground" : "bg-surface text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}
