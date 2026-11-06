"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRating } from "@/lib/utils/format";
import { Star, starFills } from "./star-rating";

const LABELS: Record<number, string> = {
  0.5: "Unlistenable",
  1: "Awful",
  1.5: "Very poor",
  2: "Poor",
  2.5: "Mixed",
  3: "Decent",
  3.5: "Good",
  4: "Great",
  4.5: "Excellent",
  5: "Masterpiece",
};

/**
 * Half-star rating input (0.5–5).
 * - Pointer: hover previews; the left half of a star picks x.5.
 * - Keyboard: it is an ARIA slider. ←/→ step by 0.5, Home/End jump,
 *   Delete/Backspace clears.
 * - Clicking the current value again clears it.
 */
export function StarRatingInput({
  value,
  onChange,
  size = 28,
  disabled = false,
  showLabel = true,
  className,
  "aria-label": ariaLabel = "Your rating",
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  size?: number;
  disabled?: boolean;
  showLabel?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const labelId = useId();
  const shown = hover ?? value ?? 0;

  function valueFromPointer(event: PointerEvent<HTMLButtonElement>, index: number) {
    const rect = event.currentTarget.getBoundingClientRect();
    const isLeftHalf = event.clientX - rect.left < rect.width / 2;
    return index + (isLeftHalf ? 0.5 : 1);
  }

  function commit(next: number | null) {
    if (disabled) return;
    onChange(next !== null && next === value ? null : next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const current = value ?? 0;
    let next: number | null | undefined;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = Math.min(5, current + 0.5);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = current <= 0.5 ? null : current - 0.5;
        break;
      case "Home":
        next = 0.5;
        break;
      case "End":
        next = 5;
        break;
      case "Delete":
      case "Backspace":
        next = null;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(next ?? null);
  }

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-valuemin={0.5}
        aria-valuemax={5}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value ? `${formatRating(value)} stars, ${LABELS[value]}` : "Not rated"}
        aria-describedby={showLabel ? labelId : undefined}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        onPointerLeave={() => setHover(null)}
        className={cn(
          "inline-flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {starFills(shown).map((fill, index) => (
          <button
            key={index}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="px-0.5 transition-transform duration-100 hover:scale-110 active:scale-95"
            onPointerMove={(event) => setHover(valueFromPointer(event, index))}
            onClick={(event) =>
              commit(valueFromPointer(event as unknown as PointerEvent<HTMLButtonElement>, index))
            }
          >
            <Star fill={fill} size={size} />
          </button>
        ))}
      </div>

      {showLabel ? (
        <span id={labelId} className="flex min-w-24 items-center gap-2 text-sm" aria-live="polite">
          {shown > 0 ? (
            <>
              <span className="font-mono text-foreground tabular-nums">{formatRating(shown)}</span>
              <span className="text-muted-foreground">{LABELS[shown]}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Not rated</span>
          )}
        </span>
      ) : null}

      {value !== null && !disabled ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Remove rating"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
