"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label + control + hint/error wiring with correct aria attributes.
 * The render prop receives the ids to spread onto the control.
 */
export function FormField({
  label,
  hint,
  error,
  className,
  labelAside,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  labelAside?: React.ReactNode;
  children: (props: {
    id: string;
    "aria-invalid": boolean | undefined;
    "aria-describedby": string | undefined;
  }) => React.ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-[0.8125rem] font-medium text-foreground/90">
          {label}
        </Label>
        {labelAside}
      </div>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={errorId} className="text-[0.8125rem] text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[0.8125rem] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormAlert({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2.5 text-sm",
        tone === "error" && "border-destructive/30 bg-destructive/[0.06] text-destructive",
        tone === "success" && "border-signal/30 bg-signal/[0.06] text-signal",
        tone === "info" && "border-border bg-surface text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}
