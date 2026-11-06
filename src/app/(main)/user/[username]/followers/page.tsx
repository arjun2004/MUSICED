import { Suspense } from "react";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { FollowListPage, parsePage } from "@/features/profile/components/follow-list-page";

export default function FollowersPage({ params, searchParams }: PageProps<"/user/[username]/followers">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Body params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ params, searchParams }: PageProps<"/user/[username]/followers">) {
  const [{ username }, query] = await Promise.all([params, searchParams]);
  return <FollowListPage username={username} direction="followers" page={parsePage(query.page)} />;
}
