"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { reportContent } from "@/features/moderation/actions";
import type { ReportInput } from "@/lib/validation/listening";

const REASONS: { value: ReportInput["reason"]; label: string }[] = [
  { value: "spam", label: "Spam or advertising" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate speech" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "violence", label: "Violence or threats" },
  { value: "impersonation", label: "Impersonation" },
  { value: "misinformation", label: "Misinformation" },
  { value: "copyright", label: "Copyright" },
  { value: "other", label: "Something else" },
];

export function ReportDialog({
  targetType,
  targetId,
  trigger,
}: {
  targetType: ReportInput["targetType"];
  targetId: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportInput["reason"]>("spam");
  const [details, setDetails] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await reportContent({ targetType, targetId, reason, details });
      if (result.ok) {
        toast.success(result.message ?? "Report sent.");
        setOpen(false);
        setDetails("");
      } else toast.error(result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Flag data-icon="inline-start" /> Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this {targetType}</DialogTitle>
          <DialogDescription>Reports are private. The person won&apos;t know who reported them.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReportInput["reason"])} className="gap-2">
          {REASONS.map((r) => (
            <Label key={r.value} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 font-normal hover:bg-surface">
              <RadioGroupItem value={r.value} />
              {r.label}
            </Label>
          ))}
        </RadioGroup>
        <Textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Anything that would help our moderators (optional)"
          aria-label="Report details"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending} className="font-semibold">
            {pending ? "Sending…" : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
