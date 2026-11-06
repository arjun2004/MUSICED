import Image from "next/image";
import { cn } from "@/lib/utils";

/** Deterministic hue from the album title for the no-artwork placeholder. */
function hueFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

/**
 * Square album artwork. When no artwork exists (Cover Art Archive has none),
 * renders an honest typographic sleeve with the title and artist instead of
 * a stand-in image. Never fabricate artwork.
 */
export function AlbumCover({
  src,
  title,
  artist,
  sizes = "(min-width: 1024px) 200px, (min-width: 640px) 25vw, 45vw",
  priority = false,
  className,
  rounded = "rounded-[3px]",
}: {
  src: string | null | undefined;
  title: string;
  artist?: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  rounded?: string;
}) {
  const base = cn(
    "relative aspect-square w-full overflow-hidden bg-surface",
    "shadow-[0_1px_0_rgb(255_255_255/0.04)_inset,0_8px_24px_-12px_rgb(0_0_0/0.6)]",
    rounded,
    className,
  );

  if (!src) {
    const hue = hueFor(title + (artist ?? ""));
    return (
      <div
        className={base}
        role="img"
        aria-label={`${title}${artist ? ` by ${artist}` : ""} (no artwork available)`}
        style={{
          background: `linear-gradient(150deg, hsl(${hue} 14% 22%), hsl(${(hue + 40) % 360} 10% 14%))`,
        }}
      >
        <div className="absolute inset-0 flex flex-col justify-between p-[9%]">
          <span className="line-clamp-3 text-[clamp(0.7rem,7cqw,1.05rem)] leading-tight font-semibold tracking-tight text-foreground/90 [container-type:inline-size]">
            {title}
          </span>
          {artist ? (
            <span className="eyebrow line-clamp-1 !text-[0.6rem] !text-foreground/50">{artist}</span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={base}>
      <Image
        src={src}
        alt={`${title}${artist ? ` by ${artist}` : ""} album cover`}
        fill
        sizes={sizes}
        // Next 16: `priority` is deprecated; above-the-fold art loads eagerly.
        loading={priority ? "eager" : undefined}
        fetchPriority={priority ? "high" : undefined}
        className="object-cover"
      />
      {/* Hairline inner border keeps dark covers from bleeding into the page. */}
      <div className={cn("pointer-events-none absolute inset-0 ring-1 ring-white/[0.06] ring-inset", rounded)} />
    </div>
  );
}
