"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/states";

export default function MainError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-page py-16">
      <ErrorState
        title="This page hit a wrong note"
        description={
          error.digest
            ? `Something went wrong on our side. Reference: ${error.digest}`
            : "Something went wrong loading this page."
        }
        onRetry={reset}
      />
    </div>
  );
}
