import { Skeleton } from "@/components/ui/skeleton";

export function ListsSkeleton() {
  return (
    <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[2.2/1]" />
          <Skeleton className="mt-3 h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
