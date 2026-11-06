import type { Metadata } from "next";
import Link from "next/link";
import { publicEnv } from "@/lib/env";
import { SignupForm } from "@/features/authentication/components/signup-form";
import { AuthDivider, GoogleButton } from "@/features/authentication/components/google-button";

export const metadata: Metadata = {
  title: "Join MUSICED",
  description: "Create your free MUSICED account and start your listening diary.",
};

export default function SignupPage() {
  const googleEnabled = publicEnv().NEXT_PUBLIC_AUTH_GOOGLE_ENABLED;
  return (
    <div className="animate-fade-up">
      <p className="eyebrow mb-3">Join MUSICED</p>
      <h1 className="heading text-3xl">Start your listening diary</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">
        Already a member?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
      {googleEnabled ? (
        <>
          <GoogleButton next="/onboarding" />
          <AuthDivider />
        </>
      ) : null}
      <SignupForm />
    </div>
  );
}
