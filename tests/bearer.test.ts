import { describe, expect, it } from "vitest";
import { bearerToken } from "@/lib/auth/constants";

describe("bearerToken", () => {
  it("reads the token from a well-formed header", () => {
    expect(bearerToken("Bearer abc123")).toBe("abc123");
  });

  it("accepts any casing of the scheme", () => {
    // Clients differ, and RFC 7235 says the scheme is case-insensitive.
    expect(bearerToken("bearer abc123")).toBe("abc123");
    expect(bearerToken("BEARER abc123")).toBe("abc123");
  });

  it("tolerates surrounding and repeated whitespace", () => {
    expect(bearerToken("  Bearer   abc123  ")).toBe("abc123");
  });

  it("ignores other schemes", () => {
    expect(bearerToken("Basic abc123")).toBeNull();
    expect(bearerToken("Token abc123")).toBeNull();
  });

  it("returns null for nothing to read", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken("Bearer")).toBeNull();
    expect(bearerToken("Bearer   ")).toBeNull();
  });

  it("does not mistake a bare token for a bearer header", () => {
    // Guards against accepting a raw token pasted without the scheme, which
    // would let a proxy's stray header authenticate a request.
    expect(bearerToken("abc123")).toBeNull();
  });

  it("keeps base64url tokens intact", () => {
    // generateToken() emits base64url: A-Z a-z 0-9 - _ and no padding.
    const token = "xY9-_aBcDeF0123456789-_xY9aBcDeF0123456789xY";
    expect(bearerToken(`Bearer ${token}`)).toBe(token);
  });
});
