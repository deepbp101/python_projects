"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type {
  AccessLevel,
  CollaboratorRole,
  WorkspaceSection,
} from "@/generated/prisma/enums";

type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: string;
  /** Null for pages everyone in the workspace can reach. */
  section: WorkspaceSection | null;
};

/**
 * Workspace navigation: a sidebar on desktop, a fixed bottom bar on mobile —
 * most wedding planning happens on a phone.
 */
export function WorkspaceNav({
  weddingId,
  access,
  role,
}: {
  weddingId: string;
  access: Record<WorkspaceSection, AccessLevel>;
  role: CollaboratorRole;
}) {
  const pathname = usePathname();
  const base = `/w/${weddingId}`;

  const items: NavItem[] = [
    { href: `${base}/dashboard`, label: "Dashboard", short: "Home", icon: "◆", section: null },
    { href: `${base}/checklist`, label: "Checklist", short: "Tasks", icon: "✓", section: "TASKS" },
    { href: `${base}/budget`, label: "Budget", short: "Budget", icon: "$", section: "BUDGET" },
    { href: `${base}/guests`, label: "Guest list", short: "Guests", icon: "♥", section: "GUESTS" },
    { href: `${base}/seating`, label: "Seating chart", short: "Seating", icon: "▦", section: "SEATING" },
    { href: `${base}/moodboard`, label: "Mood board", short: "Mood", icon: "❋", section: "MOODBOARD" },
    { href: `${base}/website`, label: "Wedding website", short: "Site", icon: "◈", section: "WEBSITE" },
    { href: `${base}/settings`, label: "Settings", short: "More", icon: "⚙", section: null },
  ];

  const visible = items.filter(
    (item) => item.section === null || access[item.section] !== "NONE",
  );

  return (
    <>
      <nav className="hidden px-3 pb-6 lg:block">
        <ul className="space-y-1">
          {visible.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-clay-soft font-medium text-clay-dark"
                      : "text-ink-soft hover:bg-surface-sunk hover:text-ink",
                  )}
                >
                  <span aria-hidden className="w-4 text-center text-xs">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 px-3 text-[11px] uppercase tracking-wide text-ink-faint">
          Signed in as {role.toLowerCase()}
        </p>
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface lg:hidden">
        <ul className="flex">
          {visible.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors",
                    active ? "text-clay-dark" : "text-ink-faint",
                  )}
                >
                  <span aria-hidden className="text-sm">
                    {item.icon}
                  </span>
                  {item.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
