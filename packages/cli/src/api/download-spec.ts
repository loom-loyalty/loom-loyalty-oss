/**
 * Download OpenAPI specification from the dashboard
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { classifyToken } from "../auth/token.js";

interface DownloadOptions {
  /** WorkOS session JWT (browser login) or an llk_-prefixed M2M API key (CI) */
  token: string;
  /** Dashboard URL (default: https://dashboard.loomloyalty.com) */
  dashboardUrl?: string;
  /** Output file path */
  outputPath: string;
}

/**
 * Download the OpenAPI spec and save to file
 */
export async function downloadOpenApiSpec(options: DownloadOptions): Promise<void> {
  const { token, outputPath } = options;
  const dashboardUrl = options.dashboardUrl || "https://dashboard.loomloyalty.com";

  // Check token validity before attempting download
  const classification = classifyToken(token);
  if (classification.kind === "unknown") {
    throw new Error(
      "Invalid access token. Expected a WorkOS session token (browser login) or an llk_ M2M API key (CI). " +
        "Provide a valid --token, or omit --token to re-authenticate via the browser."
    );
  }
  if (classification.kind === "jwt" && classification.expired) {
    throw new Error(
      "Access token has expired. Please re-authenticate by running the command without the --token flag."
    );
  }

  const specUrl = `${dashboardUrl}/api/openapi/spec`;

  console.log(`Downloading OpenAPI spec from ${specUrl}...`);

  const response = await fetch(specUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Failed to download OpenAPI spec: ${response.status} ${response.statusText}\n${text}`
    );
  }

  const specContent = await response.text();

  // Ensure directory exists
  const dir = dirname(outputPath);
  await mkdir(dir, { recursive: true });

  // Write spec to file
  await writeFile(outputPath, specContent, "utf-8");

  console.log(`OpenAPI spec saved to ${outputPath}`);
}
