import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListMusic, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/states";
import { getViewer } from "@/lib/auth/session";
import { getProfileByUsername } from "@/features/profile/queries";
import { getUserLists } from "@/features/lists/queries";
import { ListCard, ListGrid } from "@/features/lists/components/list-card";
import { ListsSkeleton } from "@/features/lists/components/lists-skeleton";

export default function UserListsPage({ params }: PageProps<"/user/[username]/lists">) {
  return (
    <Suspense fallback={<ListsSkeleton />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Pick<PageProps<"/user/[username]/lists">, "params">) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  const [viewer, lists] = await Promise.all([getViewer(), getUserLists(profile.id)]);
  const isSelf = viewer?.id === profile.id;
  const name = profile.display_name || profile.username;

  return (
    <div>
      {isSelf ? (
        <div className="mb-8 flex justify-end">
          <Button asChild size="sm" className="font-semibold">
            <Link href="/lists/new">
              <Plus data-icon="inline-start" /> New list
            </Link>
          </Button>
        </div>
      ) : null}
      {lists.length > 0 ? (
        <ListGrid>
          {lists.map((list) => (
            <ListCard key={list.id} list={list} showOwner={false} />
          ))}
        </ListGrid>
      ) : (
        <EmptyState
          icon={ListMusic}
          title={isSelf ? "You haven't made a list yet" : `${name} hasn't shared any lists`}
          description={isSelf ? "Rank your all-time favourites, or collect albums around a theme." : undefined}
          action={isSelf ? { label: "Create a list", href: "/lists/new" } : undefined}
        />
      )}
    </div>
  );
}
