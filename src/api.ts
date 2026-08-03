/**
 * Baserow REST API client.
 * A thin wrapper that adds JWT auth to any request.
 */
import type { BaserowAuth } from "./auth.js";

export interface ApiResponse {
  status: number;
  data: unknown;
}

export class BaserowApiClient {
  private auth: BaserowAuth;
  private baseUrl: string;

  constructor(auth: BaserowAuth, baseUrl: string) {
    this.auth = auth;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  /**
   * Make an authenticated API request.
   * This is the single entry point — the MCP tool calls this directly.
   */
  async request(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, string | undefined>;
    } = {},
  ): Promise<ApiResponse> {
    const token = await this.auth.getAccessToken();

    // Build URL with query params
    const url = new URL(this.baseUrl + path);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, value);
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: "JWT " + token,
    };

    const fetchOptions: RequestInit = { method, headers };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(options.body);
    }

    const resp = await fetch(url.toString(), fetchOptions);

    // Handle no-content responses (204, DELETE, etc.)
    if (resp.status === 204 || resp.headers.get("content-length") === "0") {
      return { status: resp.status, data: null };
    }

    const text = await resp.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!resp.ok) {
      const errMsg = typeof data === "string" ? data : JSON.stringify(data);
      throw new Error(
        "API " + method + " " + path + " failed (" + resp.status + "): " + errMsg,
      );
    }

    return { status: resp.status, data };
  }
}
