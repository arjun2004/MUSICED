import { UserX } from "lucide-react";
import { EmptyState } from "@/components/shared/states";

export default function ProfileNotFound() {
  return (
    <div className="py-16">
      <EmptyState
        icon={UserX}
        title="No listener by that name"
        description="They may have changed their username, or the account no longer exists."
        action={{ label: "Browse listeners", href: "/members" }}
      />
    </div>
  );
}
