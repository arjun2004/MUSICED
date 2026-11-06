import { getViewerProfile } from "@/lib/auth/session";

/** Site-wide notice for suspended accounts (reads the session; render in Suspense). */
export async function SuspendedBanner() {
  const profile = await getViewerProfile();
  if (!profile?.suspended_at) return null;
  return (
    <div role="status" className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
      Your account is suspended. You can still browse, but you can&apos;t post, rate or follow until a moderator lifts it.
    </div>
  );
}
