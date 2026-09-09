import type {
  AccessLevel,
  CollaboratorRole,
  WorkspaceSection,
} from "@/generated/prisma/enums";

/**
 * Access rules for a wedding workspace.
 *
 * The couple (OWNER/PARTNER) always has full access. Planners and family get a
 * sensible default per section, which the couple can then override row by row
 * in CollaboratorPermission.
 */

export const WORKSPACE_SECTIONS: WorkspaceSection[] = [
  "TASKS",
  "BUDGET",
  "GUESTS",
  "VENDORS",
  "SEATING",
  "MOODBOARD",
  "WEBSITE",
];

export const SECTION_LABELS: Record<WorkspaceSection, string> = {
  TASKS: "Checklist",
  BUDGET: "Budget",
  GUESTS: "Guest list",
  VENDORS: "Vendors",
  SEATING: "Seating chart",
  MOODBOARD: "Mood board",
  WEBSITE: "Wedding website",
};

export const ROLE_LABELS: Record<CollaboratorRole, string> = {
  OWNER: "Owner",
  PARTNER: "Partner",
  PLANNER: "Planner",
  FAMILY: "Family & friends",
};

const ALL_EDIT = Object.fromEntries(
  WORKSPACE_SECTIONS.map((section) => [section, "EDIT" as AccessLevel]),
) as Record<WorkspaceSection, AccessLevel>;

/** Starting point for a role, before any per-section overrides. */
export function defaultPermissionsForRole(
  role: CollaboratorRole,
): Record<WorkspaceSection, AccessLevel> {
  switch (role) {
    case "OWNER":
    case "PARTNER":
      return { ...ALL_EDIT };
    case "PLANNER":
      // A planner does the legwork everywhere except the couple's private
      // budget, which they can see but not change.
      return {
        TASKS: "EDIT",
        BUDGET: "VIEW",
        GUESTS: "EDIT",
        VENDORS: "EDIT",
        SEATING: "EDIT",
        MOODBOARD: "EDIT",
        WEBSITE: "EDIT",
      };
    case "FAMILY":
      return {
        TASKS: "VIEW",
        BUDGET: "NONE",
        GUESTS: "VIEW",
        VENDORS: "NONE",
        SEATING: "VIEW",
        MOODBOARD: "VIEW",
        WEBSITE: "VIEW",
      };
  }
}

const ACCESS_RANK: Record<AccessLevel, number> = {
  NONE: 0,
  VIEW: 1,
  EDIT: 2,
};

export type PermissionRow = { section: WorkspaceSection; access: AccessLevel };

/**
 * Effective access for one section.
 *
 * OWNER and PARTNER are deliberately not overridable — locking the couple out
 * of their own wedding is never the intent, and it would leave a workspace
 * with no one able to restore access.
 */
export function resolveAccess(
  role: CollaboratorRole,
  permissions: PermissionRow[],
  section: WorkspaceSection,
): AccessLevel {
  if (role === "OWNER" || role === "PARTNER") return "EDIT";
  const override = permissions.find((p) => p.section === section);
  return override?.access ?? defaultPermissionsForRole(role)[section];
}

export function resolveAllAccess(
  role: CollaboratorRole,
  permissions: PermissionRow[],
): Record<WorkspaceSection, AccessLevel> {
  return Object.fromEntries(
    WORKSPACE_SECTIONS.map((section) => [
      section,
      resolveAccess(role, permissions, section),
    ]),
  ) as Record<WorkspaceSection, AccessLevel>;
}

export function hasAccess(
  role: CollaboratorRole,
  permissions: PermissionRow[],
  section: WorkspaceSection,
  required: AccessLevel,
): boolean {
  return (
    ACCESS_RANK[resolveAccess(role, permissions, section)] >=
    ACCESS_RANK[required]
  );
}

export function canView(
  role: CollaboratorRole,
  permissions: PermissionRow[],
  section: WorkspaceSection,
): boolean {
  return hasAccess(role, permissions, section, "VIEW");
}

export function canEdit(
  role: CollaboratorRole,
  permissions: PermissionRow[],
  section: WorkspaceSection,
): boolean {
  return hasAccess(role, permissions, section, "EDIT");
}

/** Only the couple may manage collaborators, billing-level settings and deletion. */
export function canManageWorkspace(role: CollaboratorRole): boolean {
  return role === "OWNER" || role === "PARTNER";
}

/**
 * What a collaborator's per-section overrides should become after an edit.
 *
 * Returning `null` means "leave the stored rows alone". The case that matters is
 * a role *change* with no explicit permissions: overrides are stored rows, so a
 * planner demoted to family would otherwise keep their planner-era EDIT on
 * vendors and VIEW on the budget. Demotion is exactly when that must not happen,
 * so a role change without explicit permissions resets to the new role's
 * defaults.
 */
export function permissionsAfterUpdate(
  currentRole: CollaboratorRole,
  nextRole: CollaboratorRole | undefined,
  explicit: PermissionRow[] | undefined,
): PermissionRow[] | null {
  if (explicit) return explicit;
  if (!nextRole || nextRole === currentRole) return null;

  return WORKSPACE_SECTIONS.map((section) => ({
    section,
    access: defaultPermissionsForRole(nextRole)[section],
  }));
}
