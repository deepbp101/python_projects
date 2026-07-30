import { describe, expect, it } from "vitest";
import {
  createBudgetCategorySchema,
  createSeatingTableSchema,
  parseGuestCsv,
  updateBudgetCategorySchema,
  updateBudgetItemSchema,
  updateGuestSchema,
  updateMoodItemSchema,
  updatePaymentSchema,
  updateSeatingTableSchema,
  updateSiteEventSchema,
  updateVendorSchema,
  updateWeddingVendorSchema,
  shareIntoThreadSchema,
  addWeddingVendorSchema,
} from "@/lib/validation";

/**
 * Update schemas must not invent values.
 *
 * Zod's `.partial()` keeps each field's `.default()`, so a PATCH carrying one
 * field would silently reset every other defaulted field — dragging a table
 * would reset its capacity, renaming a budget category would zero its budget.
 * These tests pin the behaviour that stops that happening again.
 */
describe("update schemas leave omitted fields alone", () => {
  it("does not resurrect defaults when a seating table is dragged", () => {
    const parsed = updateSeatingTableSchema.parse({ x: 22.5, y: 81.25 });

    expect(parsed).toEqual({ x: 22.5, y: 81.25 });
    expect(parsed).not.toHaveProperty("capacity");
    expect(parsed).not.toHaveProperty("shape");
    expect(parsed).not.toHaveProperty("rotation");
  });

  it("does not zero a budget category when only the name changes", () => {
    const parsed = updateBudgetCategorySchema.parse({ name: "Flowers" });

    expect(parsed).toEqual({ name: "Flowers" });
    expect(parsed).not.toHaveProperty("plannedAmount");
    expect(parsed).not.toHaveProperty("alertThresholdPct");
    expect(parsed).not.toHaveProperty("color");
  });

  it("does not zero amounts when a budget item is renamed", () => {
    const parsed = updateBudgetItemSchema.parse({ name: "Venue hire" });

    expect(parsed).not.toHaveProperty("plannedAmount");
    expect(parsed).not.toHaveProperty("actualAmount");
  });

  it("does not relabel a payment when only its due date moves", () => {
    const parsed = updatePaymentSchema.parse({ dueDate: "2027-01-05" });

    expect(parsed).not.toHaveProperty("label");
    expect(parsed).not.toHaveProperty("amount");
  });

  it("does not wipe a guest's tags or age group on a small edit", () => {
    const parsed = updateGuestSchema.parse({ phone: "+1 555 0100" });

    expect(parsed).not.toHaveProperty("tagIds");
    expect(parsed).not.toHaveProperty("ageGroup");
    expect(parsed).not.toHaveProperty("lastName");
    expect(parsed).not.toHaveProperty("plusOneAllowed");
  });

  it("does not recategorise a mood board item when its note changes", () => {
    const parsed = updateMoodItemSchema.parse({ note: "Love this shape." });
    expect(parsed).not.toHaveProperty("category");
  });

  it("does not reorder a site event when its name changes", () => {
    const parsed = updateSiteEventSchema.parse({ name: "Reception" });
    expect(parsed).not.toHaveProperty("sortOrder");
  });

  it("does not recategorise a vendor listing when its phone number changes", () => {
    const parsed = updateVendorSchema.parse({ phone: "+1 555 0100" });
    expect(parsed).not.toHaveProperty("category");
    expect(parsed).not.toHaveProperty("name");
  });

  it("does not reset a vendor's status when a note is added", () => {
    const parsed = updateWeddingVendorSchema.parse({ notes: "Waiting on them." });
    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("budgetItemId");
  });

  it("still applies the values that were sent", () => {
    expect(updateSeatingTableSchema.parse({ capacity: 10 })).toEqual({
      capacity: 10,
    });
  });

  it("still rejects invalid values", () => {
    expect(() => updateSeatingTableSchema.parse({ x: 150 })).toThrow();
    expect(() => updateSeatingTableSchema.parse({ capacity: 0 })).toThrow();
    expect(() =>
      updateBudgetCategorySchema.parse({ color: "not-a-colour" }),
    ).toThrow();
  });
});

describe("create schemas still apply defaults", () => {
  it("fills in a new table's shape and capacity", () => {
    expect(createSeatingTableSchema.parse({ name: "Table 1" })).toMatchObject({
      shape: "ROUND",
      capacity: 8,
      x: 50,
      y: 50,
    });
  });

  it("fills in a new budget category's threshold", () => {
    expect(
      createBudgetCategorySchema.parse({ name: "Flowers" }),
    ).toMatchObject({ plannedAmount: 0, alertThresholdPct: 90 });
  });
});

describe("one-of-two request schemas", () => {
  it("shares either the mood board or a budget line, never both or neither", () => {
    expect(shareIntoThreadSchema.parse({ moodBoard: true })).toMatchObject({
      moodBoard: true,
    });
    expect(
      shareIntoThreadSchema.parse({ budgetItemId: "abc123" }),
    ).toMatchObject({ budgetItemId: "abc123" });

    expect(() => shareIntoThreadSchema.parse({})).toThrow();
    expect(() =>
      shareIntoThreadSchema.parse({ moodBoard: true, budgetItemId: "abc123" }),
    ).toThrow();
  });

  it("adds a vendor by directory id or by description, not both", () => {
    expect(
      addWeddingVendorSchema.parse({ vendorId: "abc123" }),
    ).toMatchObject({ vendorId: "abc123" });
    expect(
      addWeddingVendorSchema.parse({ vendor: { name: "Wildflower Studio" } }),
    ).toMatchObject({ vendor: { name: "Wildflower Studio", category: "OTHER" } });

    expect(() => addWeddingVendorSchema.parse({})).toThrow();
    expect(() =>
      addWeddingVendorSchema.parse({
        vendorId: "abc123",
        vendor: { name: "Wildflower Studio" },
      }),
    ).toThrow();
  });
});

describe("parseGuestCsv", () => {
  it("reads the paste format, requiring only a first name", () => {
    const rows = parseGuestCsv(
      [
        "Jordan, Ellis, jordan@example.com, The Ellis Family, Family",
        "Riley, Chen, , , Friends|Work",
        "Sam",
      ].join("\n"),
    );

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      firstName: "Jordan",
      lastName: "Ellis",
      email: "jordan@example.com",
      householdName: "The Ellis Family",
      tags: ["Family"],
    });
    expect(rows[1]).toMatchObject({
      email: null,
      householdName: null,
      tags: ["Friends", "Work"],
    });
    expect(rows[2]).toMatchObject({ firstName: "Sam", lastName: "" });
  });

  it("skips blank lines and comments", () => {
    expect(parseGuestCsv("\n# a comment\n\nSam\n")).toHaveLength(1);
  });

  it("drops a value that is not an email rather than storing it", () => {
    expect(parseGuestCsv("Sam, Ortiz, not-an-email")[0].email).toBeNull();
  });

  it("returns nothing for empty input", () => {
    expect(parseGuestCsv("")).toEqual([]);
    expect(parseGuestCsv("   \n  ")).toEqual([]);
  });
});
