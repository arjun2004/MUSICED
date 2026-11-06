import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { EmptyState } from "@/components/shared/states";
import { ReviewCard } from "@/components/reviews/review-card";
import { getViewer } from "@/lib/auth/session";
import { getProfileByUsername } from "@/features/profile/queries";
import { parsePage } from "@/features/profile/components/follow-list-page";
import { getUserReviews } from "@/features/listening/queries";

export default function UserReviewsPage({ params, searchParams }: PageProps<"/user/[username]/reviews">) {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <Body params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ params, searchParams }: PageProps<"/user/[username]/reviews">) {
  const [{ username }, query] = await Promise.all([params, searchParams]);
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  const page = parsePage(query.page);
  const [viewer, result] = await Promise.all([getViewer(), getUserReviews(profile.id, page)]);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const isOwner = viewer?.id === profile.id;

  if (result.reviews.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareText}
        title={isOwner ? "You haven't written a review yet" : "No reviews to show"}
        description={isOwner ? "Open an album and press Review to write one." : undefined}
        action={isOwner ? { label: "Find an album", href: "/search" } : undefined}
      />
    );
  }

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">{result.total} {result.total === 1 ? "review" : "reviews"}</p>
      <div className="divide-y divide-hairline">
        {result.reviews.map((review) => (
          <ReviewCard key={review.id} review={review} showAuthor={false} />
        ))}
      </div>
      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-between">
          <Button asChild variant="secondary" size="sm" className={page <= 1 ? "pointer-events-none opacity-40" : ""}>
            <Link href={`?page=${page - 1}`}>Newer</Link>
          </Button>
          <span className="font-mono text-xs text-muted-foreground">Page {page} of {pages}</span>
          <Button asChild variant="secondary" size="sm" className={page >= pages ? "pointer-events-none opacity-40" : ""}>
            <Link href={`?page=${page + 1}`}>Older</Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
