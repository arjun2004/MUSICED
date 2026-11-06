import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared/states";
import { requireViewer } from "@/lib/auth/session";
import { signOut } from "@/features/authentication/actions";
import { ResetPasswordForm } from "@/features/authentication/components/password-forms";
import { SettingsSkeleton } from "@/features/profile/components/settings-skeleton";
import { DeleteAccount } from "@/features/profile/components/delete-account";
import { getViewerProfile } from "@/lib/auth/session";

export const metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <Body />
    </Suspense>
  );
}

async function Body() {
  const viewer = await requireViewer("/settings/account");
  const profile = await getViewerProfile();
  return (
    <div className="grid gap-12">
      <section>
        <SectionHeader title="Email" />
        <p className="font-mono text-sm">{viewer.email ?? "—"}</p>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">
          Used to sign in and for account emails. Never shown publicly.
        </p>
      </section>

      <section>
        <SectionHeader title="Change password" />
        <div className="max-w-sm">
          <ResetPasswordForm />
        </div>
      </section>

      {profile?.username ? (
        <section>
          <SectionHeader title="Danger zone" />
          <p className="mb-4 text-sm text-muted-foreground">Delete your account and everything in it, permanently.</p>
          <DeleteAccount username={profile.username} />
        </section>
      ) : null}

      <section>
        <SectionHeader title="Session" />
        <form action={signOut}>
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </section>
    </div>
  );
}
