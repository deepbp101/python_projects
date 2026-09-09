"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import {
  AssistantIcon,
  BudgetIcon,
  CelebrationsIcon,
  CheckIcon,
  CloseIcon,
  GuestsIcon,
  HomeIcon,
  MoodIcon,
  MoreIcon,
  SeatingIcon,
  SettingsIcon,
  SiteIcon,
  VendorsIcon,
} from "@/components/icons";
import type {
  AccessLevel,
  CollaboratorRole,
  WorkspaceSection,
} from "@/generated/prisma/enums";

type NavItem = {
  href: string;
  label: string;
  /** Shown under the icon on the mobile bar, where the full label will not fit. */
  short: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Null for pages everyone in the workspace can reach. */
  section: WorkspaceSection | null;
  /** Mobile bar placement. Everything else lives behind "More". */
  primary?: boolean;
};

/**
 * Workspace navigation.
 *
 * Eleven destinations is too many for one flat list on either screen, and the
 * previous version put all eleven side by side in the mobile bar — 32px per tap
 * target, well under the 44px minimum, with the labels colliding into each other.
 *
 * So: on mobile, four destinations plus "More", which opens a sheet holding the
 * rest. On desktop, the same eleven grouped under headings, because "which of
 * these is about the guests?" should be answerable without reading all of them.
 */

const GROUPS: { heading: string; items: (base: string) => NavItem[] }[] = [
  {
    heading: "Planning",
    items: (base) => [
      {
        href: `${base}/dashboard`,
        label: "Dashboard",
        short: "Home",
        Icon: HomeIcon,
        section: null,
        primary: true,
      },
      {
        href: `${base}/checklist`,
        label: "Checklist",
        short: "Tasks",
        Icon: CheckIcon,
        section: "TASKS",
        primary: true,
      },
      {
        href: `${base}/budget`,
        label: "Budget",
        short: "Budget",
        Icon: BudgetIcon,
        section: "BUDGET",
        primary: true,
      },
      {
        href: `${base}/guests`,
        label: "Guest list",
        short: "Guests",
        Icon: GuestsIcon,
        section: "GUESTS",
        primary: true,
      },
      {
        href: `${base}/vendors`,
        label: "Vendors",
        short: "Vendors",
        Icon: VendorsIcon,
        section: "VENDORS",
      },
      {
        href: `${base}/seating`,
        label: "Seating chart",
        short: "Seating",
        Icon: SeatingIcon,
        section: "SEATING",
      },
    ],
  },
  {
    heading: "What guests see",
    items: (base) => [
      {
        href: `${base}/website`,
        label: "Wedding website",
        short: "Site",
        Icon: SiteIcon,
        section: "WEBSITE",
      },
      {
        // Was also labelled "Guests" on the mobile bar, identically to the guest
        // list — two different destinations under one word.
        href: `${base}/celebrations`,
        label: "Photos & guest book",
        short: "Photos",
        Icon: CelebrationsIcon,
        section: "WEBSITE",
      },
    ],
  },
  {
    heading: "Ideas",
    items: (base) => [
      {
        href: `${base}/moodboard`,
        label: "Mood board",
        short: "Mood",
        Icon: MoodIcon,
        section: "MOODBOARD",
      },
      {
        href: `${base}/assistant`,
        label: "Assistant",
        short: "Write",
        Icon: AssistantIcon,
        section: "MOODBOARD",
      },
    ],
  },
];

const settingsItem = (base: string): NavItem => ({
  href: `${base}/settings`,
  label: "Settings",
  short: "Settings",
  Icon: SettingsIcon,
  section: null,
});

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
  const [sheetOpen, setSheetOpen] = useState(false);

  const allowed = (item: NavItem) =>
    item.section === null || access[item.section] !== "NONE";

  const groups = GROUPS.map((group) => ({
    heading: group.heading,
    items: group.items(base).filter(allowed),
  })).filter((group) => group.items.length > 0);

  const flat = [...groups.flatMap((group) => group.items), settingsItem(base)];
  const primary = flat.filter((item) => item.primary);
  const overflow = flat.filter((item) => !item.primary);

  // A sheet that stays open while the page scrolls behind it feels detached.
  useEffect(() => {
    if (!sheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sheetOpen]);

  const isActive = (href: string) => pathname === href;
  const overflowActive = overflow.some((item) => isActive(item.href));

  return (
    <>
      {/* ---------------------------------------------------------------- desktop */}
      <nav className="hidden px-3 pb-6 lg:block">
        {groups.map((group) => (
          <div key={group.heading} className="mb-5">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              {group.heading}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <SidebarLink item={item} active={isActive(item.href)} />
                </li>
              ))}
            </ul>
          </div>
        ))}

        <ul className="border-t border-line pt-4">
          <li>
            <SidebarLink
              item={settingsItem(base)}
              active={isActive(`${base}/settings`)}
            />
          </li>
        </ul>

        <p className="mt-4 px-3 text-[11px] uppercase tracking-wide text-ink-faint">
          Signed in as {role.toLowerCase()}
        </p>
      </nav>

      {/* ----------------------------------------------------------------- mobile */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Sections"
      >
        <ul className="flex">
          {primary.map((item) => (
            <li key={item.href} className="flex-1">
              <BarLink item={item} active={isActive(item.href)} />
            </li>
          ))}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-expanded={sheetOpen}
              className={clsx(
                "flex min-h-[52px] w-full flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] transition-colors",
                overflowActive || sheetOpen
                  ? "text-clay-dark"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              <MoreIcon className="h-5 w-5" />
              More
            </button>
          </li>
        </ul>
      </nav>

      {sheetOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-ink/30"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-lg">
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <p className="font-display text-lg text-ink">Everything else</p>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close menu"
                className="-mr-2 rounded-full p-2 text-ink-soft hover:bg-surface-sunk"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-1 p-3">
              {overflow.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    // Dismissed on the tap that navigates: left open, it would
                    // cover the page just arrived at, which reads as the tap
                    // having done nothing.
                    onClick={() => setSheetOpen(false)}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={clsx(
                      "flex min-h-[52px] items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors",
                      isActive(item.href)
                        ? "bg-clay-soft font-medium text-clay-dark"
                        : "text-ink hover:bg-surface-sunk",
                    )}
                  >
                    <item.Icon className="h-5 w-5 shrink-0 text-ink-soft" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
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
      <item.Icon
        className={clsx("h-[18px] w-[18px] shrink-0", !active && "text-ink-faint")}
      />
      {item.label}
    </Link>
  );
}

function BarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex min-h-[52px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] transition-colors",
        active ? "text-clay-dark" : "text-ink-soft hover:text-ink",
      )}
    >
      <item.Icon className="h-5 w-5" />
      {item.short}
    </Link>
  );
}
