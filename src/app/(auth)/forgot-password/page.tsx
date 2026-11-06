import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/features/authentication/components/password-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="animate-fade-up">
      <p className="eyebrow mb-3">Account recovery</p>
      <h1 className="heading text-3xl">Forgot your password?</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">
        Enter the email you signed up with and we&apos;ll send you a link to choose a new one.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
