import type { SiteTemplate } from "@/generated/prisma/enums";

/**
 * Look and feel for the public wedding site.
 *
 * Each template is a small set of class strings rather than a separate page
 * component, so adding a template never risks one design drifting out of sync
 * with the content the others render.
 */
export type TemplateTheme = {
  label: string;
  description: string;
  page: string;
  hero: string;
  eyebrow: string;
  heading: string;
  body: string;
  muted: string;
  card: string;
  rule: string;
  chip: string;
  align: string;
};

export const SITE_TEMPLATES: Record<SiteTemplate, TemplateTheme> = {
  CLASSIC: {
    label: "Classic",
    description: "Warm cream, serif headings, everything centred.",
    page: "bg-[#faf7f2] text-[#2f2a26]",
    hero: "bg-gradient-to-b from-[#f2e7db] to-[#faf7f2]",
    eyebrow: "text-[#b08968] tracking-[0.3em]",
    heading: "font-display",
    body: "text-[#2f2a26]",
    muted: "text-[#6c6259]",
    card: "border-[#e7ded1] bg-white",
    rule: "bg-[#e7ded1]",
    chip: "bg-[#f2e7db] text-[#8c6e50]",
    align: "text-center items-center",
  },
  GARDEN: {
    label: "Garden",
    description: "Soft sage and botanical calm, gently centred.",
    page: "bg-[#f6f8f3] text-[#2c3128]",
    hero: "bg-gradient-to-b from-[#eaeee5] to-[#f6f8f3]",
    eyebrow: "text-[#7d8471] tracking-[0.3em]",
    heading: "font-display",
    body: "text-[#2c3128]",
    muted: "text-[#5f6659]",
    card: "border-[#dde4d6] bg-white",
    rule: "bg-[#dde4d6]",
    chip: "bg-[#eaeee5] text-[#5b6353]",
    align: "text-center items-center",
  },
  MODERN: {
    label: "Modern",
    description: "High contrast, sans-serif, left aligned.",
    page: "bg-white text-[#16161a]",
    hero: "bg-[#16161a] text-white",
    eyebrow: "text-[#b9868b] tracking-[0.25em]",
    heading: "font-sans font-semibold tracking-tight",
    body: "text-[#16161a]",
    muted: "text-[#5b5b66]",
    card: "border-[#e5e5ea] bg-white",
    rule: "bg-[#e5e5ea]",
    chip: "bg-[#f2f2f5] text-[#16161a]",
    align: "text-left items-start",
  },
};

export const TEMPLATE_ORDER: SiteTemplate[] = ["CLASSIC", "GARDEN", "MODERN"];
