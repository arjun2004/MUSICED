import { Skeleton } from "@/components/ui/skeleton";

export function SettingsSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-28" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-24" />
    </div>
  );
}
