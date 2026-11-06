import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, SectionHeader } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import { getViewerProfile, requireViewer } from "@/lib/auth/session";
import { getModerationLog, getReportQueue } from "@/features/moderation/queries";
import { ModerationActions } from "@/features/moderation/components/moderation-actions";
import { RelativeTime } from "@/components/shared/relative-time";

export const metadata = { title: "Moderation", robots: { index: false } };

const REASON_LABEL: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  hate: "Hate speech",
  sexual_content: "Sexual content",
  violence: "Violence",
  impersonation: "Impersonation",
  misinformation: "Misinformation",
  copyright: "Copyright",
  other: "Other",
};

export default function ModerationPage({ searchParams }: PageProps<"/admin/moderation">) {
  return (
    <div className="container-page">
      <PageHeader eyebrow="Staff" title="Moderation" description="Every action requires a reason and is recorded in the audit log." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ searchParams }: Pick<PageProps<"/admin/moderation">, "searchParams">) {
  await requireViewer("/admin/moderation");
  const profile = await getViewerProfile();
  // Non-staff get a plain 404: the console's existence isn't advertised.
  if (!profile || (profile.role !== "moderator" && profile.role !== "admin")) notFound();

  const params = await searchParams;
  const tab = params.tab === "closed" ? "closed" : "open";
  const [queue, log] = await Promise.all([getReportQueue(tab), getModerationLog(30)]);

  return (
    <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section>
        <nav aria-label="Report status" className="mb-6 flex gap-6 border-b border-hairline">
          {(["open", "closed"] as const).map((t) => (
            <Link
              key={t}
              href={t === "open" ? "/admin/moderation" : "/admin/moderation?tab=closed"}
              aria-current={tab === t ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 py-2.5 text-sm font-medium capitalize",
                tab === t ? "border-signal text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </Link>
          ))}
        </nav>

        {queue.length === 0 ? (
          <EmptyState icon={ShieldCheck} title={tab === "open" ? "Queue is clear" : "No closed reports yet"} />
        ) : (
          <ol className="grid gap-5">
            {queue.map((item) => (
              <li key={`${item.targetType}:${item.targetId}`} className="rounded-md border border-border bg-surface/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow mb-1">
                      {item.targetType} · {item.reports.length} {item.reports.length === 1 ? "report" : "reports"} · first <RelativeTime iso={item.firstReportedAt} suffix=" ago" />
                    </p>
                    <p className="font-medium">{item.preview.title}</p>
                    {item.preview.authorUsername ? (
                      <p className="text-xs text-muted-foreground">
                        by @{item.preview.authorUsername}
                        {item.preview.suspended ? <span className="ml-2 text-destructive">suspended</span> : null}
                        {item.preview.hidden ? <span className="ml-2 text-signal">hidden</span> : null}
                      </p>
                    ) : null}
                  </div>
                  {item.preview.href ? (
                    <Link href={item.preview.href} target="_blank" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      Open <ExternalLink className="size-3" aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
                {item.preview.excerpt ? (
                  <blockquote className="mt-3 border-l-2 border-border pl-3 text-sm whitespace-pre-line text-foreground/80">
                    {item.preview.excerpt}
                  </blockquote>
                ) : null}
                <ul className="mt-3 grid gap-1 text-xs text-muted-foreground">
                  {item.reports.map((r) => (
                    <li key={r.id}>
                      <span className="font-medium text-foreground/80">{REASON_LABEL[r.reason] ?? r.reason}</span> from @{r.reporter}
                      {r.details ? <> — “{r.details}”</> : null}
                    </li>
                  ))}
                </ul>
                {tab === "open" ? (
                  <ModerationActions
                    targetType={item.targetType}
                    targetId={item.targetId}
                    authorId={item.preview.authorId}
                    hidden={item.preview.hidden}
                    suspended={item.preview.suspended}
                    exists={item.preview.exists}
                  />
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <aside>
        <SectionHeader title="Audit log" />
        {log.length === 0 ? (
          <p className="text-sm text-muted-foreground">No actions yet.</p>
        ) : (
          <ol className="grid gap-3 text-sm">
            {log.map((entry) => (
              <li key={entry.id} className="border-b border-hairline pb-3">
                <p>
                  <span className="font-medium">@{entry.moderator}</span>{" "}
                  <span className="text-muted-foreground">{entry.action.replace(/_/g, " ")}</span>{" "}
                  <span className="font-mono text-xs">{entry.target_type}</span>
                </p>
                <p className="text-xs text-muted-foreground">“{entry.reason}” · <RelativeTime iso={entry.created_at} suffix=" ago" /></p>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}
