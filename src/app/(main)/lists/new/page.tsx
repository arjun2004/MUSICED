import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/states";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth/session";
import { ListDetailsForm } from "@/features/lists/components/list-details-form";

export const metadata: Metadata = { title: "New list", robots: { index: false } };

export default function NewListPage() {
  return (
    <div className="container-page max-w-2xl">
      <PageHeader eyebrow="Lists" title="Start a new list" description="Give it a name now. You'll add albums on the next screen." />
      <Suspense fallback={<Skeleton className="h-72" />}>
        <Body />
      </Suspense>
    </div>
  );
}

async function Body() {
  const viewer = await requireViewer("/lists/new");
  const supabase = await createClient();
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("default_list_visibility")
    .eq("user_id", viewer.id)
    .maybeSingle();

  return (
    <ListDetailsForm
      initial={{
        title: "",
        description: "",
        isRanked: false,
        visibility: prefs?.default_list_visibility ?? "public",
      }}
      submitLabel="Create and add albums"
    />
  );
}
