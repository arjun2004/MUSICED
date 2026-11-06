import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * MUSICED mark: a record seen edge-on — concentric grooves with a lime
 * "needle drop" quadrant. Works at 16px and scales cleanly.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <circle cx="16" cy="16" r="15" fill="#202428" />
      <circle cx="16" cy="16" r="11.5" fill="none" stroke="#3a4046" strokeWidth="1" />
      <circle cx="16" cy="16" r="8" fill="none" stroke="#3a4046" strokeWidth="1" />
      <path d="M16 1a15 15 0 0 1 15 15H16Z" fill="#a3e635" />
      <circle cx="16" cy="16" r="3.2" fill="#151719" />
      <circle cx="16" cy="16" r="1.2" fill="#a3e635" />
    </svg>
  );
}

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 rounded-md text-foreground focus-visible:outline-offset-4",
        className,
      )}
      aria-label="MUSICED home"
    >
      <LogoMark className="transition-transform duration-500 group-hover:rotate-90" />
      <span className="text-[1.0625rem] font-semibold tracking-[-0.04em]">
        musiced<span className="text-signal">.</span>
      </span>
    </Link>
  );
}
