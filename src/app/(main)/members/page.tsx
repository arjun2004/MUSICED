import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SearchX, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { ListenerRow } from "@/components/social/listener-row";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { getViewer } from "@/lib/auth/session";
import { getViewerFollowingSet, listMembers } from "@/features/social/queries";
import { parsePage } from "@/features/profile/components/follow-list-page";
import { MemberSearch } from "@/features/social/components/member-search";

export const metadata: Metadata = {
  title: "Listeners",
  description: "Find people with great taste in music and follow their listening diaries.",
};

const PAGE_SIZE = 24;

export default function MembersPage({ searchParams }: PageProps<"/members">) {
  return (
    <div className="container-page">
      <PageHeader
        eyebrow="Community"
        title="Listeners"
        description="Follow people whose taste you trust. Their ratings, reviews and diary entries shape your feed."
        actions={
          <Suspense fallback={<div className="h-9 w-64" />}>
            <MemberSearch />
          </Suspense>
        }
      />
      <Suspense fallback={<ListSkeleton rows={8} />}>
        <MembersList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function MembersList({ searchParams }: Pick<PageProps<"/members">, "searchParams">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 50) : "";
  const page = parsePage(params.page);

  const [viewer, result] = await Promise.all([
    getViewer(),
    listMembers({ search: q, page, pageSize: PAGE_SIZE }),
  ]);
  const followingSet = await getViewerFollowingSet(viewer?.id ?? null, result.people.map((p) => p.id));
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  if (result.people.length === 0) {
    return q ? (
      <EmptyState icon={SearchX} title={`No listeners match “${q}”`} description="Try a different name or username." />
    ) : (
      <EmptyState
        icon={Users}
        title="No listeners yet"
        description="MUSICED is brand new. Be one of the first and invite friends who love music."
        action={{ label: "Join MUSICED", href: "/signup" }}
      />
    );
  }

  const pageHref = (n: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`;

  return (
    <div>
      <p className="eyebrow mb-2">
        {result.total} {result.total === 1 ? "listener" : "listeners"}
        {q ? ` matching “${q}”` : ""}
      </p>
      <div className="grid gap-x-10 divide-y divide-hairline md:grid-cols-2 md:divide-y-0">
        {result.people.map((person) => (
          <ListenerRow
            key={person.id}
            person={person}
            viewerId={viewer?.id ?? null}
            isFollowing={followingSet.has(person.id)}
            className="md:border-b md:border-hairline"
          />
        ))}
      </div>
      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-between">
          <Button asChild variant="secondary" size="sm" className={page <= 1 ? "pointer-events-none opacity-40" : ""}>
            <Link href={pageHref(page - 1)}>Previous</Link>
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button asChild variant="secondary" size="sm" className={page >= pages ? "pointer-events-none opacity-40" : ""}>
            <Link href={pageHref(page + 1)}>Next</Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
