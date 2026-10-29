import { describe, expect, it } from "vitest";
import { SESSION_COOKIE_NAME } from "../shared/constants";
import { createClearSessionCookie, createSessionCookie, parseSessionCookie } from "./session";

describe("session cookies", () => {
  it("keeps the existing cookie name when no name is provided", () => {
    expect(createSessionCookie("sealed-session")).toContain(
      `${SESSION_COOKIE_NAME}=sealed-session`
    );
    expect(createClearSessionCookie()).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(parseSessionCookie(`${SESSION_COOKIE_NAME}=sealed-session`)).toBe("sealed-session");
  });

  it("uses an explicit cookie name when provided", () => {
    const cookieName = "loom_portal_session";

    expect(createSessionCookie("sealed-session", cookieName)).toContain(
      `${cookieName}=sealed-session`
    );
    expect(createClearSessionCookie(cookieName)).toContain(`${cookieName}=`);
    expect(parseSessionCookie(`${cookieName}=sealed-session`, cookieName)).toBe("sealed-session");
  });

  it("uses strict, secure, host-only cookie attributes", () => {
    for (const cookie of [createSessionCookie("sealed-session"), createClearSessionCookie()]) {
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Strict");
      expect(cookie).not.toMatch(/(?:^|;\\s*)Domain=/i);
    }
  });
});
