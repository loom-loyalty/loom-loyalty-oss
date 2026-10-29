import { describe, expect, it } from "vitest";

import { safeHref, safeMailto } from "./safe-href.js";

describe("safeHref", () => {
  it("passes http and https URLs through unchanged", () => {
    expect(safeHref("https://example.com")).toBe("https://example.com");
    expect(safeHref("http://example.com/path?q=1")).toBe("http://example.com/path?q=1");
    expect(safeHref("HTTPS://EXAMPLE.COM")).toBe("HTTPS://EXAMPLE.COM");
  });

  it("rejects dangerous schemes", () => {
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("JavaScript:alert(1)")).toBeUndefined();
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeHref("vbscript:msgbox(1)")).toBeUndefined();
    expect(safeHref("file:///etc/passwd")).toBeUndefined();
  });

  it("rejects scheme-relative and relative values", () => {
    expect(safeHref("//evil.com")).toBeUndefined();
    expect(safeHref("/relative/path")).toBeUndefined();
    expect(safeHref("example.com")).toBeUndefined();
  });

  it("does not throw on non-string input", () => {
    expect(safeHref(null)).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
    expect(safeHref(42)).toBeUndefined();
  });
});

describe("safeMailto", () => {
  it("builds a mailto href for plain email addresses", () => {
    expect(safeMailto("a@b.com")).toBe("mailto:a@b.com");
    expect(safeMailto("john.doe+tag@example.co.uk")).toBe("mailto:john.doe+tag@example.co.uk");
  });

  it("rejects values containing a colon (scheme-injection hygiene)", () => {
    expect(safeMailto("javascript:alert(1)@b.com")).toBeUndefined();
    expect(safeMailto("mailto:a@b.com")).toBeUndefined();
  });

  it("rejects malformed addresses", () => {
    expect(safeMailto("not-an-email")).toBeUndefined();
    expect(safeMailto("a@b")).toBeUndefined();
    expect(safeMailto("a b@c.com")).toBeUndefined();
    expect(safeMailto("")).toBeUndefined();
  });

  it("does not throw on non-string input", () => {
    expect(safeMailto(null)).toBeUndefined();
    expect(safeMailto(undefined)).toBeUndefined();
    expect(safeMailto(42)).toBeUndefined();
  });
});
