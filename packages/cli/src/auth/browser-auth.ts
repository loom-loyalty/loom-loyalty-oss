/**
 * Browser-based authentication for CLI
 *
 * Flow:
 * 1. Start local HTTP server on random port
 * 2. Open browser to dashboard /api/cli/token with callback URL
 * 3. Dashboard validates session, redirects with JWT token
 * 4. Receive token via callback and return it
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { URL } from "node:url";
import open from "open";

interface AuthResult {
  token: string;
}

interface AuthOptions {
  /** Dashboard URL (default: https://dashboard.loomloyalty.com) */
  dashboardUrl?: string;
  /** Timeout in milliseconds (default: 5 minutes) */
  timeout?: number;
}

const DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Authenticate via browser and return JWT token
 */
export async function authenticateViaBrowser(options: AuthOptions = {}): Promise<AuthResult> {
  if (process.env.CI) {
    throw new Error(
      "Browser-based authentication is unavailable in CI (no interactive browser). " +
        "Pass a token via `treadle generate --token <token>` (or `-t`), sourced from a " +
        "CLI_AUTH_TOKEN secret, instead of relying on the browser flow."
    );
  }

  const dashboardUrl = options.dashboardUrl || "https://dashboard.loomloyalty.com";
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  return new Promise((resolve, reject) => {
    let server: Server | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (server) {
        // Force close all connections to allow process to exit
        server.closeAllConnections();
        server.close();
        server = null;
      }
    };

    // Create local server to receive callback
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || "/", `http://localhost`);

      if (url.pathname === "/callback") {
        const token = url.searchParams.get("token");
        const error = url.searchParams.get("error");

        if (error) {
          // Return error page (using CSS named colors for standalone HTML)
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: crimson;">Authentication Failed</h1>
                <p>${escapeHtml(error)}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          cleanup();
          reject(new Error(error));
          return;
        }

        if (token) {
          // Return success page (using CSS named colors for standalone HTML)
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>Authentication Successful</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: seagreen;">Authentication Successful</h1>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);
          cleanup();
          resolve({ token });
          return;
        }

        // No token or error (using CSS named colors for standalone HTML)
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Invalid Callback</title></head>
            <body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h1 style="color: crimson;">Invalid Callback</h1>
              <p>No token received. Please try again.</p>
            </body>
          </html>
        `);
        return;
      }

      // Unknown route
      res.writeHead(404);
      res.end("Not Found");
    });

    // Listen on random port
    server.listen(0, "127.0.0.1", () => {
      const address = server!.address();
      if (!address || typeof address === "string") {
        cleanup();
        reject(new Error("Failed to get server address"));
        return;
      }

      const callbackUrl = `http://127.0.0.1:${address.port}/callback`;
      const authUrl = `${dashboardUrl}/api/cli/token?callback=${encodeURIComponent(callbackUrl)}`;

      console.log("\nOpening browser for authentication...");
      console.log(`If the browser doesn't open, visit:\n${authUrl}\n`);

      // Open browser (don't wait for it to close)
      open(authUrl, { wait: false })
        .then((cp) => {
          // Unref the child process so it doesn't keep Node alive
          cp.unref();
        })
        .catch((err) => {
          console.warn("Could not open browser automatically:", err.message);
          console.log(`Please open this URL manually:\n${authUrl}\n`);
        });

      // Set timeout
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Authentication timed out. Please try again."));
      }, timeout);
    });

    server.on("error", (err) => {
      cleanup();
      reject(err);
    });
  });
}

/**
 * Escape HTML to prevent XSS in error messages
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
