import { describe, expect, it } from "vitest";
import {
  canEdit,
  canManageWorkspace,
  canView,
  defaultPermissionsForRole,
  permissionsAfterUpdate,
  resolveAccess,
  resolveAllAccess,
  WORKSPACE_SECTIONS,
} from "@/lib/permissions";

describe("defaultPermissionsForRole", () => {
  it("covers every section for every role", () => {
    for (const role of ["OWNER", "PARTNER", "PLANNER", "FAMILY"] as const) {
      const permissions = defaultPermissionsForRole(role);
      for (const section of WORKSPACE_SECTIONS) {
        expect(permissions[section]).toBeDefined();
      }
    }
  });

  it("gives the couple edit access everywhere", () => {
    for (const role of ["OWNER", "PARTNER"] as const) {
      for (const section of WORKSPACE_SECTIONS) {
        expect(defaultPermissionsForRole(role)[section]).toBe("EDIT");
      }
    }
  });

  it("gives a planner view-only access to the budget", () => {
    const planner = defaultPermissionsForRole("PLANNER");
    expect(planner.BUDGET).toBe("VIEW");
    expect(planner.TASKS).toBe("EDIT");
    expect(planner.GUESTS).toBe("EDIT");
  });

  it("hides the budget from family by default", () => {
    expect(defaultPermissionsForRole("FAMILY").BUDGET).toBe("NONE");
    expect(defaultPermissionsForRole("FAMILY").TASKS).toBe("VIEW");
  });
});

describe("resolveAccess", () => {
  it("falls back to the role default when no override exists", () => {
    expect(resolveAccess("FAMILY", [], "TASKS")).toBe("VIEW");
    expect(resolveAccess("FAMILY", [], "BUDGET")).toBe("NONE");
  });

  it("applies a per-section override", () => {
    expect(
      resolveAccess("FAMILY", [{ section: "BUDGET", access: "VIEW" }], "BUDGET"),
    ).toBe("VIEW");
    expect(
      resolveAccess("PLANNER", [{ section: "BUDGET", access: "EDIT" }], "BUDGET"),
    ).toBe("EDIT");
  });

  it("leaves other sections untouched by an override", () => {
    expect(
      resolveAccess("FAMILY", [{ section: "BUDGET", access: "EDIT" }], "TASKS"),
    ).toBe("VIEW");
  });

  it("never lets an override lock the couple out of their own wedding", () => {
    for (const role of ["OWNER", "PARTNER"] as const) {
      expect(
        resolveAccess(role, [{ section: "BUDGET", access: "NONE" }], "BUDGET"),
      ).toBe("EDIT");
    }
  });
});

describe("access helpers", () => {
  it("treats EDIT as implying VIEW", () => {
    expect(canView("PLANNER", [], "TASKS")).toBe(true);
    expect(canEdit("PLANNER", [], "TASKS")).toBe(true);
  });

  it("does not treat VIEW as implying EDIT", () => {
    expect(canView("PLANNER", [], "BUDGET")).toBe(true);
    expect(canEdit("PLANNER", [], "BUDGET")).toBe(false);
  });

  it("denies both when access is NONE", () => {
    expect(canView("FAMILY", [], "BUDGET")).toBe(false);
    expect(canEdit("FAMILY", [], "BUDGET")).toBe(false);
  });

  it("restricts workspace management to the couple", () => {
    expect(canManageWorkspace("OWNER")).toBe(true);
    expect(canManageWorkspace("PARTNER")).toBe(true);
    expect(canManageWorkspace("PLANNER")).toBe(false);
    expect(canManageWorkspace("FAMILY")).toBe(false);
  });
});

describe("resolveAllAccess", () => {
  it("returns an entry for every section", () => {
    const access = resolveAllAccess("PLANNER", [
      { section: "BUDGET", access: "EDIT" },
    ]);

    expect(Object.keys(access).sort()).toEqual([...WORKSPACE_SECTIONS].sort());
    expect(access.BUDGET).toBe("EDIT");
    expect(access.SEATING).toBe("EDIT");
  });
});

describe("permissionsAfterUpdate", () => {
  it("resets overrides to the new role's defaults on a demotion", () => {
    const rows = permissionsAfterUpdate("PLANNER", "FAMILY", undefined);

    expect(rows).not.toBeNull();
    // A planner demoted to family must not keep planner-era access.
    expect(rows).toEqual(
      expect.arrayContaining([
        { section: "VENDORS", access: "NONE" },
        { section: "BUDGET", access: "NONE" },
        { section: "TASKS", access: "VIEW" },
      ]),
    );
  });

  it("covers every section, so no stale row can survive the rewrite", () => {
    const rows = permissionsAfterUpdate("FAMILY", "PLANNER", undefined) ?? [];
    expect(rows.map((row) => row.section).sort()).toEqual(
      [...WORKSPACE_SECTIONS].sort(),
    );
  });

  it("leaves stored rows alone when the role is unchanged", () => {
    expect(permissionsAfterUpdate("PLANNER", "PLANNER", undefined)).toBeNull();
    expect(permissionsAfterUpdate("PLANNER", undefined, undefined)).toBeNull();
  });

  it("prefers explicit permissions over the role defaults", () => {
    const explicit = [{ section: "BUDGET" as const, access: "EDIT" as const }];
    expect(permissionsAfterUpdate("FAMILY", "PLANNER", explicit)).toBe(explicit);
  });
});
