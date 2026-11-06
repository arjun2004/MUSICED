import { cn } from "@/lib/utils";
import { formatRating } from "@/lib/utils/format";
import { Star } from "./star-rating";

/**
 * Compact 10-bucket rating distribution (0.5 → 5.0). Bars are scaled to the
 * largest bucket. Accessible as a list with per-bucket counts.
 */
export function RatingHistogram({
  buckets,
  className,
  height = 56,
}: {
  buckets: number[];
  className?: string;
  height?: number;
}) {
  const max = Math.max(1, ...buckets);
  const total = buckets.reduce((sum, n) => sum + n, 0);

  return (
    <div className={cn("w-full", className)}>
      <ul
        className="flex items-end gap-[3px]"
        style={{ height }}
        aria-label={`Rating distribution across ${total} ratings`}
      >
        {buckets.map((count, i) => {
          const value = (i + 1) / 2;
          const pct = total === 0 ? 0 : Math.max(count === 0 ? 0 : 6, (count / max) * 100);
          return (
            <li
              key={i}
              className="group relative flex h-full flex-1 items-end"
              aria-label={`${formatRating(value)} stars: ${count}`}
            >
              <span
                className={cn(
                  "w-full rounded-t-[2px] transition-colors",
                  count > 0 ? "bg-chart-bar group-hover:bg-signal" : "bg-star-empty/60",
                )}
                style={{ height: `${pct || 3}%` }}
              />
              <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[0.625rem] whitespace-nowrap text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                {formatRating(value)} · {count}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-1.5 flex items-center justify-between text-muted-foreground" aria-hidden="true">
        <Star fill={0.5} size={10} />
        <span className="inline-flex gap-px">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} fill={1} size={10} />
          ))}
        </span>
      </div>
    </div>
  );
}
