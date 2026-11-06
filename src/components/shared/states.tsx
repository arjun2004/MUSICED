import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Section heading with optional "see all" link. */
export function SectionHeader({
  eyebrow,
  title,
  href,
  hrefLabel = "See all",
  className,
}: {
  eyebrow?: string;
  title: string;
  href?: string;
  hrefLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-4 border-b border-hairline pb-3", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h2 className="text-lg font-semibold tracking-[-0.02em]">{title}</h2>
      </div>
      {href ? (
        <Link
          href={href}
          className="eyebrow shrink-0 rounded-sm transition-colors hover:!text-signal"
        >
          {hrefLabel} →
        </Link>
      ) : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 py-8 sm:flex-row sm:items-end sm:justify-between sm:py-10", className)}>
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
        <h1 className="heading sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 text-[0.9375rem] text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-4 inline-flex size-10 items-center justify-center rounded-full bg-surface text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      ) : null}
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-pretty text-muted-foreground">{description}</p>
      ) : null}
      {action ? (
        <Button asChild variant="secondary" size="sm" className="mt-5">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this right now. Please try again.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-destructive/20 bg-destructive/[0.04] px-6 py-12 text-center",
        className,
      )}
    >
      <AlertTriangle className="mb-3 size-5 text-destructive" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
