import { cn } from "@/lib/utils";
import { formatRating } from "@/lib/utils/format";

const STAR_PATH =
  "M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96L12 2.5z";

type StarProps = { fill: 0 | 0.5 | 1; size: number; className?: string };

/** A single star, fully/half/un-filled. Pure SVG, no client JS. */
export function Star({ fill, size, className }: StarProps) {
  const id = `half-${size}`;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {fill === 0.5 ? (
        <>
          <defs>
            <clipPath id={id}>
              <rect x="0" y="0" width="12" height="24" />
            </clipPath>
          </defs>
          <path d={STAR_PATH} className="fill-star-empty" />
          <path d={STAR_PATH} className="fill-star" clipPath={`url(#${id})`} />
        </>
      ) : (
        <path d={STAR_PATH} className={fill === 1 ? "fill-star" : "fill-star-empty"} />
      )}
    </svg>
  );
}

export function starFills(value: number): (0 | 0.5 | 1)[] {
  return Array.from({ length: 5 }, (_, i) => {
    const remaining = value - i;
    if (remaining >= 1) return 1;
    if (remaining >= 0.5) return 0.5;
    return 0;
  });
}

/**
 * Read-only star display. Screen readers get "Rated 4.5 out of 5".
 * `compact` hides empty stars (feed style: ★★★★½).
 */
export function StarRating({
  value,
  size = 14,
  compact = false,
  showValue = false,
  className,
}: {
  value: number | null;
  size?: number;
  compact?: boolean;
  showValue?: boolean;
  className?: string;
}) {
  if (value === null || value === undefined) return null;
  const fills = starFills(value);
  const visible = compact ? fills.filter((f) => f > 0) : fills;

  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      role="img"
      aria-label={`Rated ${formatRating(value)} out of 5`}
    >
      <span className="inline-flex items-center gap-px">
        {visible.map((fill, i) => (
          <Star key={i} fill={fill} size={size} />
        ))}
      </span>
      {showValue ? (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {formatRating(value)}
        </span>
      ) : null}
    </span>
  );
}
