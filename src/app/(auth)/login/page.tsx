import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { publicEnv } from "@/lib/env";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";
import { LoginForm } from "@/features/authentication/components/login-form";
import { AuthDivider, GoogleButton } from "@/features/authentication/components/google-button";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="animate-fade-up">
      <p className="eyebrow mb-3">Welcome back</p>
      <h1 className="heading text-3xl">Sign in to your diary</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
      <Suspense fallback={<FormSkeleton />}>
        <LoginBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LoginBody({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const next = safeRedirectPath(typeof params.next === "string" ? params.next : undefined, "/");
  const error = typeof params.error === "string" ? params.error.slice(0, 200) : undefined;

  return (
    <>
      {publicEnv().NEXT_PUBLIC_AUTH_GOOGLE_ENABLED ? (
        <>
          <GoogleButton next={next} />
          <AuthDivider />
        </>
      ) : null}
      <LoginForm next={next} initialError={error} />
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="mt-2 h-10" />
    </div>
  );
}
