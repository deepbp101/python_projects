/**
 * Pure wedding-site logic. Kept free of database imports so it can be tested
 * directly, in line with the rest of src/lib/domain.
 */

/** Public URL segment for a wedding site: lowercase, hyphenated, ASCII-safe. */
export function siteSlugFrom(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      // Drop combining marks left behind by the decomposition above.
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50)
      .replace(/-+$/g, "") || "our-wedding"
  );
}
