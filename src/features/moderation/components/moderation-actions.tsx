"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { moderate } from "@/features/moderation/actions";

type Target = "review" | "comment" | "list" | "profile";

export function ModerationActions({
  targetType,
  targetId,
  authorId,
  hidden,
  suspended,
  exists,
}: {
  targetType: Target;
  targetId: string;
  authorId: string | null;
  hidden: boolean;
  suspended: boolean;
  exists: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: Parameters<typeof moderate>[0]["action"], onProfile = false) {
    const id = onProfile ? authorId : targetId;
    if (!id) return;
    startTransition(async () => {
      const result = await moderate({ action, targetType: onProfile ? "profile" : targetType, targetId: id, reason });
      if (result.ok) {
        toast.success(result.message ?? "Done.");
        setReason("");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  const needsReason = reason.trim().length < 3;

  return (
    <div className="mt-4 grid gap-2">
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required, kept in the audit log)"
        aria-label="Moderation reason"
        maxLength={2000}
        className="h-9"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={pending || needsReason} onClick={() => run("dismiss")}>
          Dismiss reports
        </Button>
        {exists && targetType !== "profile" ? (
          hidden ? (
            <Button size="sm" variant="secondary" disabled={pending || needsReason} onClick={() => run("restore_content")}>
              Restore content
            </Button>
          ) : (
            <Button size="sm" disabled={pending || needsReason} onClick={() => run("hide_content")}>
              Hide content
            </Button>
          )
        ) : null}
        {exists && targetType !== "profile" ? (
          <Button size="sm" variant="destructive" disabled={pending || needsReason} onClick={() => run("delete_content")}>
            Delete
          </Button>
        ) : null}
        {authorId ? (
          suspended ? (
            <Button size="sm" variant="secondary" disabled={pending || needsReason} onClick={() => run("unsuspend_user", true)}>
              Unsuspend author
            </Button>
          ) : (
            <Button size="sm" variant="destructive" disabled={pending || needsReason} onClick={() => run("suspend_user", true)}>
              Suspend author
            </Button>
          )
        ) : null}
      </div>
    </div>
  );
}
