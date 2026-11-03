import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticateViaBrowser } from "../../src/auth/browser-auth.js";

describe("authenticateViaBrowser", () => {
  const originalCi = process.env.CI;

  afterEach(() => {
    if (originalCi === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCi;
    }
  });

  it("rejects immediately in CI instead of opening a browser and waiting on the 5-minute timeout", async () => {
    process.env.CI = "true";

    const start = Date.now();
    await expect(authenticateViaBrowser()).rejects.toThrow(/unavailable in CI.*--token/s);
    // A generous upper bound that would still fail long before the real 5-minute
    // timeout if the CI guard regressed and fell through to the browser flow.
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

const opened = vi.hoisted(() => ({ urls: [] as string[] }));
vi.mock("open", () => ({
  default: vi.fn(async (url: string) => {
    opened.urls.push(url);
    return { unref() {} };
  }),
}));

describe("authenticateViaBrowser's sign-in link", () => {
  const originalCi = process.env.CI;

  afterEach(() => {
    opened.urls.length = 0;
    if (originalCi === undefined) delete process.env.CI;
    else process.env.CI = originalCi;
  });

  async function signInWith(organization?: string) {
    delete process.env.CI;
    vi.spyOn(console, "log").mockImplementation(() => {});
    const pending = authenticateViaBrowser({
      dashboardUrl: "https://dashboard.staging.example.com",
      organization,
    });
    await vi.waitFor(() => expect(opened.urls).toHaveLength(1));
    const link = new URL(opened.urls[0]!);
    await fetch(`${link.searchParams.get("callback")}?token=h.p.s`);
    await expect(pending).resolves.toEqual({ token: "h.p.s" });
    return link;
  }

  it("names the organization to sign in to, so the browser skips the picker", async () => {
    const link = await signInWith("org_stage_dev");

    expect(link.origin + link.pathname).toBe("https://dashboard.staging.example.com/api/cli/token");
    expect(link.searchParams.get("organization")).toBe("org_stage_dev");
  });

  it("leaves the organization out without one, so the browser shows the picker", async () => {
    const link = await signInWith();

    expect(link.searchParams.has("organization")).toBe(false);
  });
});
