import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/auth/session";
import { ResetPasswordForm } from "@/features/authentication/components/password-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <div className="animate-fade-up">
      <p className="eyebrow mb-3">Account recovery</p>
      <h1 className="heading text-3xl">Choose a new password</h1>
      <Suspense fallback={<Skeleton className="mt-8 h-48" />}>
        <ResetBody />
      </Suspense>
    </div>
  );
}

/** The recovery link signs the user in; without that session it has expired. */
async function ResetBody() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <div className="mt-4">
        <p className="text-sm text-muted-foreground">
          This reset link is invalid or has expired. Links work once and only for an hour.
        </p>
        <Button asChild className="mt-6 h-10 w-full font-semibold">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="mt-8">
      <ResetPasswordForm />
    </div>
  );
}
