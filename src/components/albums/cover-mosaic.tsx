import { cn } from "@/lib/utils";
import type { AlbumSummary } from "@/types/domain";
import { AlbumCover } from "./album-cover";

/**
 * Editorial wall of real album artwork from the catalog. Falls back to a
 * groove pattern when the catalog has too little artwork to fill the grid.
 */
export function CoverMosaic({
  albums,
  className,
  columns = 4,
}: {
  albums: AlbumSummary[];
  className?: string;
  columns?: 3 | 4 | 5;
}) {
  const withArt = albums.filter((album) => album.cover_url);
  if (withArt.length < columns * 2) return <GroovePattern className={className} />;

  const cols = { 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" }[columns];
  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)} aria-hidden="true">
      <div className={cn("grid -rotate-6 scale-125 gap-3 p-6", cols)}>
        {withArt.map((album, i) => (
          <div
            key={album.id}
            className="animate-fade-up"
            style={{ animationDelay: `${(i % 8) * 60}ms` }}
          >
            <AlbumCover
              src={album.cover_url}
              title={album.title}
              artist={album.artist_credit}
              sizes="160px"
              priority={i < columns * 2}
              rounded="rounded-[3px]"
            />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/10" />
    </div>
  );
}

/** Concentric-groove texture: the brand mark, abstracted. */
export function GroovePattern({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-full min-h-64 w-full overflow-hidden", className)} aria-hidden="true">
      <svg viewBox="0 0 600 600" className="absolute top-1/2 left-1/2 w-[140%] max-w-none -translate-x-1/2 -translate-y-1/2">
        {Array.from({ length: 26 }, (_, i) => (
          <circle
            key={i}
            cx="300"
            cy="300"
            r={40 + i * 10}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className={i === 7 ? "text-signal/60" : "text-white/[0.06]"}
          />
        ))}
        <path d="M300 40a260 260 0 0 1 260 260H300Z" className="fill-signal/[0.07]" />
        <circle cx="300" cy="300" r="34" className="fill-background" />
        <circle cx="300" cy="300" r="6" className="fill-signal" />
      </svg>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
    </div>
  );
}
