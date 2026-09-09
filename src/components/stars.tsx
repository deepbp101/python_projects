"use client";

import clsx from "clsx";

/** Star ratings, read-only and interactive. Kept in one place so they match. */

export function StarRating({
  value,
  count,
  className,
}: {
  value: number | null;
  count?: number;
  className?: string;
}) {
  if (value === null) {
    return (
      <span className={clsx("text-xs text-ink-faint", className)}>
        No reviews yet
      </span>
    );
  }

  return (
    <span className={clsx("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden className="text-sm text-alert">
        {"★".repeat(Math.round(value))}
        <span className="text-line-strong">{"★".repeat(5 - Math.round(value))}</span>
      </span>
      <span className="tabular text-xs text-ink-soft">
        {value.toFixed(1)}
        {count !== undefined && ` (${count})`}
      </span>
      <span className="sr-only">
        {value.toFixed(1)} out of 5
        {count !== undefined && ` from ${count} reviews`}
      </span>
    </span>
  );
}

export function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  return (
    <span role="radiogroup" aria-label="Rating" className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          onClick={() => onChange(star)}
          className={clsx(
            "rounded text-xl leading-none transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay",
            star <= value ? "text-alert" : "text-line-strong hover:text-alert/50",
          )}
        >
          ★
        </button>
      ))}
    </span>
  );
}
