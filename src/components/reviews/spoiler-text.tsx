"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Blurs spoiler-marked content until the reader opts in. */
export function SpoilerText({
  hidden,
  children,
  className,
}: {
  hidden: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(!hidden);
  if (revealed) return <div className={className}>{children}</div>;
  return (
    <div className={cn("relative", className)}>
      <div className="pointer-events-none blur-sm select-none" aria-hidden="true">
        {children}
      </div>
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="absolute inset-0 flex items-center justify-center text-xs font-medium text-foreground"
      >
        <span className="rounded-full border border-border bg-background/90 px-3 py-1.5">
          Contains spoilers · Show review
        </span>
      </button>
    </div>
  );
}
