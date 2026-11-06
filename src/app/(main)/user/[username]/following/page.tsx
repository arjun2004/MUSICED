import { Suspense } from "react";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { FollowListPage, parsePage } from "@/features/profile/components/follow-list-page";

export default function FollowingPage({ params, searchParams }: PageProps<"/user/[username]/following">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Body params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ params, searchParams }: PageProps<"/user/[username]/following">) {
  const [{ username }, query] = await Promise.all([params, searchParams]);
  return <FollowListPage username={username} direction="following" page={parsePage(query.page)} />;
}
