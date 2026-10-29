/**
 * Platform API client for CLI operations.
 *
 * Uses direct Platform API calls with bearer token authentication (a WorkOS
 * session JWT or an llk_-prefixed M2M API key). Follows the pattern established
 * by download-spec.ts.
 */

import { classifyToken, isTokenExpired } from "../auth/token.js";
import type {
  ApiDataModel,
  ApiResponse,
  CreateDataModelInput,
  ExportManifestInput,
  InstallManifestInput,
  PackageInstallation,
  PackageInstallationResult,
  PackageManifestExport,
  PaginatedApiResponse,
  PlatformPage,
  PushResult,
  UpdateDataModelInput,
  WorkflowRequest,
} from "./types.js";

export { isTokenExpired };

/**
 * Options for the API client.
 */
export interface ApiClientOptions {
  /** Base URL for the Platform API */
  baseUrl: string;
  /** WorkOS session JWT (browser login) or an llk_-prefixed M2M API key (CI) */
  token: string;
}

/**
 * Error thrown when API requests fail.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors?: Array<{ code: number; message: string }>
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The Platform's own error messages when it sent any, else the HTTP status line. */
  describe(): string {
    const messages = (this.errors ?? []).map((error) => error.message).filter(Boolean);
    return messages.length > 0 ? messages.join("; ") : this.message;
  }
}

/**
 * Client for Platform API data model operations.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.token = options.token;
  }

  /**
   * Check if the token is still valid.
   */
  isAuthenticated(): boolean {
    return !isTokenExpired(this.token);
  }

  /**
   * Make an authenticated request to the API.
   */
  private async request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const classification = classifyToken(this.token);
    if (classification.kind === "unknown") {
      throw new ApiError(
        "Invalid access token. Expected a WorkOS session token or an llk_ M2M API key.",
        401
      );
    }
    if (classification.kind === "jwt" && classification.expired) {
      throw new ApiError("Token has expired. Please re-authenticate.", 401);
    }

    const url = `${this.baseUrl}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ApiError(`Could not reach ${this.baseUrl}: ${reason}`, 0);
    }

    const text = await response.text();

    if (!response.ok) {
      let errors: Array<{ code: number; message: string }> | undefined;
      try {
        const json = JSON.parse(text);
        errors = json.errors;
      } catch {
        // Not JSON, use text as error message
      }
      throw new ApiError(
        `API request failed: ${response.status} ${response.statusText}`,
        response.status,
        errors
      );
    }

    try {
      return JSON.parse(text) as ApiResponse<T>;
    } catch {
      throw new ApiError(`Invalid JSON response: ${text}`, 500);
    }
  }

  /**
   * Fetch all data models with pagination.
   */
  async getDataModels(): Promise<ApiDataModel[]> {
    const allModels: ApiDataModel[] = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
      const response = await this.request<ApiDataModel[]>(
        "GET",
        `/data-models?page=${page}&pageSize=${pageSize}`
      );

      const paginatedResponse = response as unknown as PaginatedApiResponse<ApiDataModel>;
      const models = paginatedResponse.data || [];
      allModels.push(...models);

      // Check if we have more pages
      const pagination = paginatedResponse.pagination;
      if (!pagination || page >= pagination.totalPages) {
        break;
      }
      page++;
    }

    return allModels;
  }

  /**
   * Get a data model by ID.
   */
  async getDataModelById(id: string): Promise<ApiDataModel | null> {
    try {
      const response = await this.request<ApiDataModel>("GET", `/data-models/${id}`);
      return response.data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get a data model by code.
   */
  async getDataModelByCode(code: string): Promise<ApiDataModel | null> {
    try {
      const response = await this.request<ApiDataModel>("GET", `/data-models/by-code/${code}`);
      return response.data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new data model.
   */
  async createDataModel(input: CreateDataModelInput): Promise<ApiDataModel> {
    const response = await this.request<ApiDataModel>("POST", "/data-models", input);
    return response.data;
  }

  /**
   * Update an existing data model (only works for DRAFT models).
   */
  async updateDataModel(id: string, input: UpdateDataModelInput): Promise<ApiDataModel> {
    const response = await this.request<ApiDataModel>("PUT", `/data-models/${id}`, input);
    return response.data;
  }

  /**
   * Delete a data model.
   */
  async deleteDataModel(id: string): Promise<void> {
    await this.request<void>("DELETE", `/data-models/${id}`);
  }

  /**
   * Publish a draft data model (makes it immutable).
   */
  async publishDataModel(id: string): Promise<ApiDataModel> {
    const response = await this.request<ApiDataModel>("POST", `/data-models/${id}/publish`);
    return response.data;
  }

  /**
   * Create a new version from a published model.
   */
  async createDataModelVersion(sourceId: string): Promise<ApiDataModel> {
    const response = await this.request<ApiDataModel>("POST", "/data-models/versions", {
      sourceDataModelId: sourceId,
    });
    return response.data;
  }

  /**
   * Get all versions of a data model by code.
   */
  async getDataModelVersions(code: string): Promise<ApiDataModel[]> {
    const response = await this.request<ApiDataModel[]>(
      "GET",
      `/data-models/by-code/${code}/versions`
    );
    return response.data || [];
  }

  /**
   * Get the latest published version of a data model.
   */
  async getLatestPublished(code: string): Promise<ApiDataModel | null> {
    try {
      const response = await this.request<ApiDataModel>(
        "GET",
        `/data-models/by-code/${code}/latest-published`
      );
      return response.data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get JSON schema for a data model by ID.
   */
  async getDataModelSchema(id: string): Promise<Record<string, unknown> | null> {
    try {
      const response = await this.request<Record<string, unknown>>(
        "GET",
        `/data-models/${id}/schema`
      );
      return response.data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Push a data model, handling create/update/version logic automatically.
   *
   * - If model doesn't exist → create new
   * - If model exists and is DRAFT → update in place
   * - If model exists and is PUBLISHED → create new version
   */
  async pushDataModel(input: CreateDataModelInput): Promise<PushResult> {
    const existing = await this.getDataModelByCode(input.type.code);

    if (!existing) {
      // New model - create it
      const model = await this.createDataModel(input);
      return { action: "created", model };
    }

    if (existing.status === "DRAFT") {
      // Draft - update in place
      const model = await this.updateDataModel(existing.dataModelId, {
        type: input.type,
        elements: input.elements,
        jsonSchema: input.jsonSchema,
      });
      return { action: "updated", model };
    }

    // Published - create new version and update it
    const newVersion = await this.createDataModelVersion(existing.dataModelId);
    const model = await this.updateDataModel(newVersion.dataModelId, {
      type: input.type,
      elements: input.elements,
      jsonSchema: input.jsonSchema,
    });
    return { action: "versioned", model };
  }

  /**
   * Plans (`dryRun`) or applies a tenant manifest: `POST /package-installations` with the manifest inline.
   * A conflicted plan is not an error; it comes back with `conflicted` set.
   */
  async installManifest(input: InstallManifestInput): Promise<PackageInstallationResult> {
    const response = await this.request<PackageInstallationResult>(
      "POST",
      "/package-installations",
      {
        code: input.code,
        dryRun: input.dryRun,
        manifest: input.manifest,
        ...(input.targetEnvironmentCode
          ? { targetEnvironmentCode: input.targetEnvironmentCode }
          : {}),
      }
    );
    return response.data;
  }

  /**
   * The organization's live configuration as a manifest with `code`: `GET
   * /package-installations/manifest-export`. Applying it to the same organization plans no change.
   */
  async exportManifest(input: ExportManifestInput): Promise<PackageManifestExport> {
    const query = new URLSearchParams({ code: input.code });
    for (const section of input.sections) query.append("sections", section);
    if (input.program) query.set("program", input.program);
    const response = await this.request<PackageManifestExport>(
      "GET",
      `/package-installations/manifest-export?${query.toString()}`
    );
    return response.data;
  }

  /** The organization's installation of package or manifest `code`, if any. */
  async findInstallation(code: string): Promise<PackageInstallation | null> {
    const response = await this.request<PackageInstallation[]>(
      "GET",
      `/package-installations?packageCode=${encodeURIComponent(code)}&page=0&size=10`
    );
    const data = response.data as unknown;
    const installations = Array.isArray(data)
      ? (data as PackageInstallation[])
      : ((data as PlatformPage<PackageInstallation> | null)?.content ?? []);
    return installations.find((installation) => installation.packageCode === code) ?? null;
  }

  /** Every workflow request the caller can see, page by page (at most `maxPages` of 100). */
  async listWorkflowRequests(maxPages = 20): Promise<WorkflowRequest[]> {
    const requests: WorkflowRequest[] = [];
    for (let page = 0; page < maxPages; page++) {
      const response = await this.request<PlatformPage<WorkflowRequest>>(
        "GET",
        `/workflow-requests?page=${page}&size=100`
      );
      const content = response.data?.content ?? [];
      requests.push(...content);
      const totalPages = response.data?.totalPages ?? 0;
      if (content.length === 0 || page + 1 >= totalPages) break;
    }
    return requests;
  }
}
