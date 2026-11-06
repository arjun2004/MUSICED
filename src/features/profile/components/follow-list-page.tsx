import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListenerRow } from "@/components/social/listener-row";
import { EmptyState } from "@/components/shared/states";
import { getViewer } from "@/lib/auth/session";
import { getFollowList, getProfileByUsername } from "@/features/profile/queries";
import { getViewerFollowingSet } from "@/features/social/queries";

const PAGE_SIZE = 30;

export async function FollowListPage({
  username,
  direction,
  page,
}: {
  username: string;
  direction: "followers" | "following";
  page: number;
}) {
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const [viewer, list] = await Promise.all([
    getViewer(),
    getFollowList(profile.id, direction, page, PAGE_SIZE),
  ]);
  const followingSet = await getViewerFollowingSet(
    viewer?.id ?? null,
    list.people.map((p) => p.id),
  );
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const name = profile.display_name || profile.username;

  if (list.people.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={direction === "followers" ? `No one follows ${name} yet` : `${name} isn't following anyone yet`}
        action={{ label: "Browse listeners", href: "/members" }}
      />
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="sr-only">{direction === "followers" ? "Followers" : "Following"}</h2>
      <div className="divide-y divide-hairline">
        {list.people.map((person) => (
          <ListenerRow
            key={person.id}
            person={person}
            viewerId={viewer?.id ?? null}
            isFollowing={followingSet.has(person.id)}
          />
        ))}
      </div>
      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-between">
          <Button asChild variant="secondary" size="sm" className={page <= 1 ? "pointer-events-none opacity-40" : ""}>
            <Link href={`?page=${page - 1}`} aria-disabled={page <= 1}>
              Previous
            </Link>
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button asChild variant="secondary" size="sm" className={page >= pages ? "pointer-events-none opacity-40" : ""}>
            <Link href={`?page=${page + 1}`} aria-disabled={page >= pages}>
              Next
            </Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

export function parsePage(value: string | string[] | undefined) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : 1;
}
