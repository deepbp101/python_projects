import { describe, expect, it } from "vitest";
import { SITE_TEMPLATES, TEMPLATE_ORDER } from "@/components/site/templates";
import { siteSlugFrom } from "@/lib/domain/site";

describe("siteSlugFrom", () => {
  it("lowercases and hyphenates a title", () => {
    expect(siteSlugFrom("Sam and Alex")).toBe("sam-and-alex");
    expect(siteSlugFrom("  Our   Wedding  ")).toBe("our-wedding");
  });

  it("spells out an ampersand, which couples use constantly", () => {
    expect(siteSlugFrom("Sam & Alex")).toBe("sam-and-alex");
  });

  it("strips punctuation and emoji rather than encoding them", () => {
    expect(siteSlugFrom("Sam + Alex's Wedding! 💍")).toBe(
      "sam-alexs-wedding",
    );
  });

  it("never produces leading or trailing hyphens", () => {
    const slug = siteSlugFrom("--- Wedding ---");
    expect(slug).toBe("wedding");
    expect(slug.startsWith("-")).toBe(false);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("falls back to a usable slug when nothing survives", () => {
    expect(siteSlugFrom("💍💐🤍")).toBe("our-wedding");
    expect(siteSlugFrom("")).toBe("our-wedding");
  });

  it("caps the length so URLs stay reasonable", () => {
    expect(siteSlugFrom("a".repeat(200)).length).toBeLessThanOrEqual(50);
  });

  it("produces something the slug validator would accept", () => {
    const pattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    for (const title of [
      "Sam & Alex",
      "The Wedding of Jo & Sam!",
      "  spaced  out  ",
      "💍 Our Big Day 💍",
    ]) {
      expect(siteSlugFrom(title)).toMatch(pattern);
    }
  });
});

describe("site templates", () => {
  it("defines every template listed in the picker order", () => {
    for (const template of TEMPLATE_ORDER) {
      expect(SITE_TEMPLATES[template]).toBeDefined();
      expect(SITE_TEMPLATES[template].label).toBeTruthy();
    }
  });

  it("gives every template the same set of style slots", () => {
    const slots = Object.keys(SITE_TEMPLATES.CLASSIC).sort();
    for (const template of TEMPLATE_ORDER) {
      expect(Object.keys(SITE_TEMPLATES[template]).sort()).toEqual(slots);
    }
  });
});
