/**
 * A browser sign-in treadle keeps: the refresh token of a WorkOS session of the CLI's own, saved in
 * the OS keychain (macOS Keychain, Windows Credential Manager, the Linux Secret Service) per
 * dashboard and organization, so later commands sign in without a browser until it ends.
 *
 * The dashboard hands the session over as a one-time code bound to a PKCE verifier that never
 * leaves this process, and refreshes it at POST /api/cli/access-tokens. An `llk_` key or a
 * `--token` is never saved. Where no keychain can be used, every command signs in through the
 * browser as before.
 */

import { createHash, randomBytes } from "node:crypto";
import { authenticateViaBrowser } from "./browser-auth.js";

const SERVICE = "treadle";

/** Where saved sign-ins live; the OS keychain outside tests. */
export interface KeyStore {
  get(account: string): string | null;
  set(account: string, value: string): void;
  delete(account: string): boolean;
}

let keychainStore: Promise<KeyStore | undefined> | undefined;

/** The OS keychain, or undefined when it can't be used here (no keyring module, a locked or absent store). */
export function osKeychain(): Promise<KeyStore | undefined> {
  keychainStore ??= (async () => {
    try {
      const { Entry } = await import("@napi-rs/keyring");
      const store: KeyStore = {
        get: (account) => new Entry(SERVICE, account).getPassword(),
        set: (account, value) => new Entry(SERVICE, account).setPassword(value),
        delete: (account) => new Entry(SERVICE, account).deletePassword(),
      };
      store.get("probe"); // throws where the store can't be reached
      return store;
    } catch {
      return undefined;
    }
  })();
  return keychainStore;
}

interface SavedSignIn {
  refreshToken: string;
  organizationId: string;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
  organizationId: string;
}

/** The keychain account of a sign-in to `dashboardUrl`'s organization environment `organization`. */
export function accountFor(dashboardUrl: string, organization: string): string {
  return `${new URL(dashboardUrl).origin}#${organization}`;
}

function read(store: KeyStore, account: string): SavedSignIn | undefined {
  try {
    const raw = store.get(account);
    if (!raw) return undefined;
    const saved = JSON.parse(raw) as Partial<SavedSignIn>;
    return typeof saved.refreshToken === "string" && typeof saved.organizationId === "string"
      ? (saved as SavedSignIn)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Saves `tokens`' refresh token; a keychain that refuses the write costs only the next login. */
function save(
  store: KeyStore,
  dashboardUrl: string,
  tokens: Tokens,
  log: (line: string) => void
): void {
  const saved: SavedSignIn = {
    refreshToken: tokens.refreshToken,
    organizationId: tokens.organizationId,
  };
  try {
    store.set(accountFor(dashboardUrl, tokens.organizationId), JSON.stringify(saved));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log(`Couldn't save the sign-in in your keychain (${reason}); you'll sign in again next time.`);
  }
}

function forget(store: KeyStore, account: string): void {
  try {
    store.delete(account);
  } catch {
    // Left as it is: the next refresh with it fails the same way and tries again.
  }
}

async function post(dashboardUrl: string, path: string, body: unknown, fetcher: typeof fetch) {
  const response = await fetcher(new URL(path, dashboardUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, json };
}

function tokensOf(json: Record<string, unknown>): Tokens | undefined {
  const { accessToken, refreshToken, organizationId } = json;
  return typeof accessToken === "string" &&
    typeof refreshToken === "string" &&
    typeof organizationId === "string"
    ? { accessToken, refreshToken, organizationId }
    : undefined;
}

export interface SignInResult {
  token: string;
  /** The organization environment signed in to, when the dashboard says. */
  organizationId?: string;
  /** How the token was had: from the keychain, a new saved sign-in, or a one-off browser login. */
  via: "saved" | "new" | "browser";
}

export interface SignInDeps {
  store?: KeyStore;
  fetcher?: typeof fetch;
  browser?: typeof authenticateViaBrowser;
  log?: (line: string) => void;
  /**
   * Without `organization`, keep the sign-in picked in the browser (`treadle use`, which then pins
   * that organization). Other commands without one pick in the browser every time and keep
   * nothing, so a saved sign-in never stands in for a pick.
   */
  keepPicked?: boolean;
}

/**
 * A token for `dashboardUrl`'s `organization`: the saved sign-in's, refreshed, else a new saved
 * sign-in through the browser. Without a keychain, or without `organization` (unless
 * `keepPicked`), a one-off browser login. A saved sign-in the dashboard says has ended is
 * forgotten and replaced.
 */
export async function signIn(
  dashboardUrl: string,
  organization?: string,
  deps: SignInDeps = {}
): Promise<SignInResult> {
  const fetcher = deps.fetcher ?? fetch;
  const browser = deps.browser ?? authenticateViaBrowser;
  const log = deps.log ?? (() => {});
  const store = organization || deps.keepPicked ? (deps.store ?? (await osKeychain())) : undefined;

  if (!store) {
    const { token } = await browser({ dashboardUrl, organization });
    return { token, via: "browser" };
  }

  if (organization) {
    const kept = await refreshSaved(store, dashboardUrl, organization, fetcher, log);
    if (kept) return kept;
  }

  const verifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(verifier).digest("base64url");
  const answer = await browser({ dashboardUrl, organization, codeChallenge });
  if (!answer.code) {
    // A dashboard without saved sign-ins answers with a token, as before: use it this once.
    log("This dashboard can't keep a CLI sign-in yet; you'll sign in again next time.");
    return { token: answer.token!, via: "browser" };
  }
  const exchanged = await post(
    dashboardUrl,
    "/api/cli/sessions",
    { code: answer.code, codeVerifier: verifier },
    fetcher
  );
  const tokens = exchanged.status === 200 ? tokensOf(exchanged.json) : undefined;
  if (!tokens) {
    const message = typeof exchanged.json.message === "string" ? exchanged.json.message : "";
    throw new Error(
      `The dashboard refused the sign-in (HTTP ${exchanged.status}). ${message}`.trim()
    );
  }
  save(store, dashboardUrl, tokens, log);
  return { token: tokens.accessToken, organizationId: tokens.organizationId, via: "new" };
}

/**
 * The saved sign-in's fresh token, or undefined when there is none or it has ended (then it is
 * forgotten). WorkOS rotates the refresh token on every refresh, so another treadle refreshing at
 * the same moment spends the one read here: a refusal is retried once with whatever it saved.
 */
async function refreshSaved(
  store: KeyStore,
  dashboardUrl: string,
  organization: string,
  fetcher: typeof fetch,
  log: (line: string) => void
): Promise<SignInResult | undefined> {
  const account = accountFor(dashboardUrl, organization);
  let saved = read(store, account);
  for (let attempt = 0; saved && attempt < 2; attempt++) {
    const refreshed = await post(
      dashboardUrl,
      "/api/cli/access-tokens",
      { refreshToken: saved.refreshToken, organizationId: saved.organizationId },
      fetcher
    );
    const tokens = refreshed.status === 200 ? tokensOf(refreshed.json) : undefined;
    if (tokens) {
      save(store, dashboardUrl, tokens, log);
      return { token: tokens.accessToken, organizationId: tokens.organizationId, via: "saved" };
    }
    // A dashboard that refreshed but couldn't finish its checks hands back the rotated refresh
    // token: keep it, so the retry has a token that still works.
    const { refreshToken: rotated } = refreshed.json;
    if (refreshed.status === 503 && typeof rotated === "string") {
      save(
        store,
        dashboardUrl,
        { accessToken: "", refreshToken: rotated, organizationId: saved.organizationId },
        log
      );
    }
    if (![400, 401, 403].includes(refreshed.status)) {
      throw new Error(
        `The dashboard couldn't refresh your saved sign-in (HTTP ${refreshed.status}). Try again in a moment.`
      );
    }
    const now = read(store, account);
    if (now && now.refreshToken !== saved.refreshToken) {
      saved = now; // another treadle rotated it meanwhile
      continue;
    }
    forget(store, account);
    log("Your saved sign-in has ended; signing in again.");
    return undefined;
  }
  return undefined;
}

/** What `treadle logout` did: whether a sign-in was saved, and whether its session ended. */
export interface ForgetResult {
  /** A sign-in was saved here (and is now forgotten). */
  saved: boolean;
  /**
   * Its WorkOS session ended on the dashboard: true, or the reason it couldn't be ended (then the
   * session lasts until its refresh token expires). Undefined when nothing was saved.
   */
  ended?: true | string;
}

/**
 * Ends the sign-in to `dashboardUrl`'s `organization` saved in the keychain: the dashboard revokes
 * its WorkOS session (DELETE /api/cli/sessions/current), then the keychain forgets it, whether or
 * not the dashboard could. Undefined without a keychain.
 */
export async function forgetSignIn(
  dashboardUrl: string,
  organization: string,
  store?: KeyStore,
  fetcher: typeof fetch = fetch
): Promise<ForgetResult | undefined> {
  const keychain = store ?? (await osKeychain());
  if (!keychain) return undefined;
  const account = accountFor(dashboardUrl, organization);
  const saved = read(keychain, account);
  const ended = saved
    ? await endSession(keychain, account, dashboardUrl, saved, fetcher)
    : undefined;
  const deleted = keychain.delete(account);
  return { saved: Boolean(saved) || deleted, ended };
}

/**
 * Asks the dashboard to end `saved`'s session. A refusal (401) means the session has ended, unless
 * another treadle rotated the refresh token meanwhile: then it is retried once with the one saved
 * now, as a refresh would be.
 */
async function endSession(
  keychain: KeyStore,
  account: string,
  dashboardUrl: string,
  saved: SavedSignIn,
  fetcher: typeof fetch
): Promise<true | string> {
  for (let attempt = 0; ; attempt++) {
    const answer = await askToEnd(dashboardUrl, saved, fetcher);
    if (answer !== 401) return answer;
    const now = read(keychain, account);
    if (attempt > 0 || !now || now.refreshToken === saved.refreshToken) return true;
    saved = now;
  }
}

async function askToEnd(
  dashboardUrl: string,
  saved: SavedSignIn,
  fetcher: typeof fetch
): Promise<true | string | 401> {
  try {
    const response = await fetcher(new URL("/api/cli/sessions/current", dashboardUrl), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refreshToken: saved.refreshToken,
        organizationId: saved.organizationId,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) return true;
    if (response.status === 401) return 401;
    // A dashboard from before logout could end sessions has no such route.
    if (response.status === 404 || response.status === 405) {
      return "this dashboard can't end CLI sessions yet";
    }
    return `the dashboard answered HTTP ${response.status}`;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
