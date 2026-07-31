import { describe, expect, it } from "vitest";
import {
  formatUnlockCode,
  looksLikeUnlockCode,
  normalizeUnlockCode,
  UNLOCK_ALPHABET,
  UNLOCK_GROUP_SIZE,
  UNLOCK_GROUPS,
  UNLOCK_PREFIX,
} from "@/lib/domain/unlock";

const BODY = "ABCD2345EFGH6789";
const PRETTY = "WED-ABCD-2345-EFGH-6789";

describe("the unlock alphabet", () => {
  it("leaves out the characters people misread", () => {
    for (const character of ["I", "O", "0", "1"]) {
      expect(UNLOCK_ALPHABET).not.toContain(character);
    }
  });

  it("has no duplicates, so every character is equally likely", () => {
    expect(new Set(UNLOCK_ALPHABET).size).toBe(UNLOCK_ALPHABET.length);
  });

  it("is a power-of-two size, which is what makes uniform sampling easy", () => {
    expect(Math.log2(UNLOCK_ALPHABET.length) % 1).toBe(0);
  });
});

describe("normalizeUnlockCode", () => {
  it("accepts the code exactly as it is printed", () => {
    expect(normalizeUnlockCode(PRETTY)).toBe(BODY);
  });

  it("does not care about case", () => {
    expect(normalizeUnlockCode(PRETTY.toLowerCase())).toBe(BODY);
  });

  it("does not care how it was spaced or punctuated", () => {
    expect(normalizeUnlockCode("wed abcd 2345 efgh 6789")).toBe(BODY);
    expect(normalizeUnlockCode("  WED–ABCD_2345.EFGH/6789  ")).toBe(BODY);
    expect(normalizeUnlockCode("WEDABCD23456789")).not.toBe(BODY); // genuinely short
  });

  it("accepts the bare body, without the prefix", () => {
    expect(normalizeUnlockCode(BODY)).toBe(BODY);
    expect(normalizeUnlockCode("abcd-2345-efgh-6789")).toBe(BODY);
  });

  it("strips only a leading prefix, never one inside the code", () => {
    // A body legitimately containing WED must survive intact.
    expect(normalizeUnlockCode("WED-ABWE-DCD2-345E-FGH6")).toBe("ABWEDCD2345EFGH6");
  });

  it("keeps a body that itself starts with WED, typed either way", () => {
    // Stripping the prefix unconditionally would eat the start of this body.
    const awkward = "WEDXABCD2345EFGH";
    expect(normalizeUnlockCode(awkward)).toBe(awkward);
    expect(normalizeUnlockCode(formatUnlockCode(awkward))).toBe(awkward);
    expect(looksLikeUnlockCode(normalizeUnlockCode(awkward))).toBe(true);
  });

  it("agrees with the printed form both ways", () => {
    expect(formatUnlockCode(BODY)).toBe(PRETTY);
    expect(normalizeUnlockCode(formatUnlockCode(BODY))).toBe(BODY);
  });
});

describe("looksLikeUnlockCode", () => {
  it("accepts a well-formed body", () => {
    expect(looksLikeUnlockCode(BODY)).toBe(true);
    expect(looksLikeUnlockCode(normalizeUnlockCode(PRETTY))).toBe(true);
  });

  it("rejects the wrong length", () => {
    expect(looksLikeUnlockCode(BODY.slice(0, -1))).toBe(false);
    expect(looksLikeUnlockCode(`${BODY}A`)).toBe(false);
    expect(looksLikeUnlockCode("")).toBe(false);
  });

  it("rejects characters that are not in the alphabet", () => {
    // Right length, but these are the four we removed on purpose.
    expect(looksLikeUnlockCode("ABCD2345EFGH678I")).toBe(false);
    expect(looksLikeUnlockCode("ABCD2345EFGH678O")).toBe(false);
    expect(looksLikeUnlockCode("ABCD2345EFGH6780")).toBe(false);
    expect(looksLikeUnlockCode("ABCD2345EFGH6781")).toBe(false);
  });

  it("rejects an unnormalised string, so callers cannot skip that step", () => {
    expect(looksLikeUnlockCode(PRETTY)).toBe(false);
    expect(looksLikeUnlockCode(BODY.toLowerCase())).toBe(false);
  });

  it("expects exactly as many characters as the format prints", () => {
    expect(BODY.length).toBe(UNLOCK_GROUPS * UNLOCK_GROUP_SIZE);
    expect(formatUnlockCode(BODY).split("-")).toHaveLength(UNLOCK_GROUPS + 1);
    expect(formatUnlockCode(BODY).split("-")[0]).toBe(UNLOCK_PREFIX);
  });
});
