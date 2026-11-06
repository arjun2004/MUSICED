import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListMusic, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, SectionHeader } from "@/components/shared/states";
import { getPublicLists } from "@/features/lists/queries";
import { ListCard, ListGrid } from "@/features/lists/components/list-card";
import { ListsSkeleton } from "@/features/lists/components/lists-skeleton";

export const metadata: Metadata = {
  title: "Lists",
  description: "Ranked countdowns, deep cuts and themed collections curated by the MUSICED community.",
};

export default function ListsPage() {
  return (
    <div className="container-page">
      <PageHeader
        eyebrow="Collections"
        title="Lists"
        description="Top 50s, genre primers, albums for rainy days. Curated by listeners, ranked or not."
        actions={
          <Button asChild className="font-semibold">
            <Link href="/lists/new">
              <Plus data-icon="inline-start" /> New list
            </Link>
          </Button>
        }
      />
      <div className="grid gap-16">
        <Suspense fallback={<ListsSkeleton />}>
          <Section sort="popular" eyebrow="Most liked" title="Popular lists" />
        </Suspense>
        <Suspense fallback={<ListsSkeleton />}>
          <Section sort="recent" eyebrow="Just updated" title="Recent lists" />
        </Suspense>
      </div>
    </div>
  );
}

async function Section({ sort, eyebrow, title }: { sort: "popular" | "recent"; eyebrow: string; title: string }) {
  const lists = await getPublicLists(sort, sort === "popular" ? 6 : 12);
  return (
    <section>
      <SectionHeader eyebrow={eyebrow} title={title} />
      {lists.length > 0 ? (
        <ListGrid>
          {lists.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
        </ListGrid>
      ) : (
        <EmptyState
          icon={ListMusic}
          title="No public lists yet"
          description="Start the first one: your all-time top 10, a genre primer, anything."
          action={{ label: "Create a list", href: "/lists/new" }}
        />
      )}
    </section>
  );
}
