import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

/** Small shared primitives, kept in one file so the styling stays consistent. */

export function Card({
  className,
  children,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(47,42,38,0.04)]",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <h2 className="font-display text-lg text-ink">{children}</h2>
      {action}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-clay text-white hover:bg-clay-dark",
  secondary:
    "border border-line-strong bg-surface text-ink hover:bg-surface-sunk",
  ghost: "text-ink-soft hover:bg-surface-sunk hover:text-ink",
  danger: "border border-danger/30 bg-danger-soft text-danger hover:bg-danger/15",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay",
        "disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_STYLES[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink-soft">{label}</span>
      {children}
      {hint && !error && (
        <span className="mt-1 block text-xs text-ink-faint">{hint}</span>
      )}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

const CONTROL_CLASS =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/20";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={clsx(CONTROL_CLASS, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={clsx(CONTROL_CLASS, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={clsx(CONTROL_CLASS, className)} {...props} />;
}

type BadgeTone = "neutral" | "clay" | "sage" | "rose" | "alert" | "danger";

const BADGE_STYLES: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunk text-ink-soft",
  clay: "bg-clay-soft text-clay-dark",
  sage: "bg-sage-soft text-sage",
  rose: "bg-rose-soft text-rose",
  alert: "bg-alert-soft text-alert",
  danger: "bg-danger-soft text-danger",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        BADGE_STYLES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Progress bar. `aria-*` attributes are set so the value is announced rather
 * than being purely visual.
 */
export function ProgressBar({
  value,
  tone = "clay",
  label,
}: {
  value: number;
  tone?: "clay" | "sage" | "rose" | "alert" | "danger";
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(value, 100));
  const fill = {
    clay: "bg-clay",
    sage: "bg-sage",
    rose: "bg-rose",
    alert: "bg-alert",
    danger: "bg-danger",
  }[tone];

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-sunk"
    >
      <div
        className={clsx("h-full rounded-full transition-[width]", fill)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </div>
      <div className="tabular mt-1 font-display text-2xl text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-soft">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="font-display text-base text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorMessage({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger"
    >
      {children}
    </p>
  );
}

/**
 * A collapsible section.
 *
 * Native `<details>` rather than a `useState` toggle: it is keyboard operable
 * and findable by in-page search for free, and it works before hydration — which
 * matters on the two longest pages in the app, where the alternative is a wall
 * of content while JavaScript loads.
 *
 * `summary` stays visible when closed, so a collapsed section is still a useful
 * row rather than a mystery. That is what makes closing things by default
 * defensible: nothing is hidden except detail.
 */
export function Disclosure({
  summary,
  defaultOpen = false,
  className,
  children,
}: {
  summary: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className={clsx("group", className)}>
      {/*
        Aligned to the top rather than centred: a summary can be three rows tall
        (a budget category carries a name, amounts and a bar), and a centred
        chevron drifts down beside the bar instead of sitting with the title it
        belongs to. On a one-line summary the offset reads as centred anyway.
      */}
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl px-1 py-1 transition-colors hover:bg-surface-sunk/60 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{summary}</span>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-1 h-4 w-4 shrink-0 text-ink-faint transition-transform group-open:rotate-180"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      {children}
    </details>
  );
}
