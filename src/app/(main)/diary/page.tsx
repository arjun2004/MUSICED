import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOnboardedProfile } from "@/lib/auth/session";

export const metadata = { title: "Your diary", robots: { index: false } };

/** /diary is a shortcut to the signed-in user's own diary. */
export default function MyDiaryPage() {
  return (
    <Suspense fallback={<Skeleton className="container-page mt-10 h-64" />}>
      <Redirect />
    </Suspense>
  );
}

async function Redirect() {
  const profile = await requireOnboardedProfile("/diary");
  redirect(`/user/${profile.username}/diary`);
  return null;
}
