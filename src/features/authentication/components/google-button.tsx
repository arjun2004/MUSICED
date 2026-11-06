"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/features/authentication/actions";

export function GoogleButton({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      className="h-10 w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await signInWithGoogle(next);
          if (result && !result.ok) toast.error(result.error);
        })
      }
    >
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
        <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
      </svg>
      {pending ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}

export function AuthDivider() {
  return (
    <div className="relative my-6 flex items-center" role="separator">
      <span className="h-px flex-1 bg-border" />
      <span className="eyebrow px-3">or</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
