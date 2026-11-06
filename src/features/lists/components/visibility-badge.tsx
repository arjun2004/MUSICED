import { Lock, Users } from "lucide-react";
import type { Visibility } from "@/types/domain";

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: "Everyone",
  followers: "Followers only",
  private: "Only me",
};

/** Small marker for non-public content; renders nothing for public. */
export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  if (visibility === "public") return null;
  const Icon = visibility === "private" ? Lock : Users;
  return (
    <span className="inline-flex items-center gap-1 rounded-[3px] bg-surface-raised px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground">
      <Icon className="size-3" aria-hidden="true" />
      {VISIBILITY_LABELS[visibility]}
    </span>
  );
}
