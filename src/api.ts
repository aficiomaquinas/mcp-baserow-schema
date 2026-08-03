/**
 * Baserow REST API client.
 * Wraps all API calls with automatic authentication and error handling.
 */
import type { BaserowAuth } from "./auth.js";

export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
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
   */
  async request<T = unknown>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined>;
    } = {},
  ): Promise<ApiResponse<T>> {
    const token = await this.auth.getAccessToken();

    // Build URL with query params
    const url = new URL(`${this.baseUrl}${path}`);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `JWT ${token}`,
    };

    const fetchOptions: RequestInit = { method, headers };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(options.body);
    }

    const resp = await fetch(url.toString(), fetchOptions);

    // Handle no-content responses (204, DELETE, etc.)
    if (resp.status === 204 || resp.headers.get("content-length") === "0") {
      return { status: resp.status, data: undefined as T };
    }

    const text = await resp.text();
    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = text as T;
    }

    if (!resp.ok) {
      const errMsg = typeof data === "string" ? data : JSON.stringify(data);
      throw new Error(`API ${method} ${path} failed (${resp.status}): ${errMsg}`);
    }

    return { status: resp.status, data };
  }

  // ──────────────────────────────────────────────
  // Discovery
  // ──────────────────────────────────────────────

  async listDatabases(workspaceId: number) {
    return this.request<unknown[]>(
      "GET",
      `/api/applications/workspace/${workspaceId}/`,
    );
  }

  async listTables(databaseId: number) {
    return this.request<unknown[]>(
      "GET",
      `/api/database/tables/database/${databaseId}/`,
    );
  }

  // ──────────────────────────────────────────────
  // Schema
  // ──────────────────────────────────────────────

  async createTable(databaseId: number, name: string, data?: unknown, firstRowHeader?: boolean) {
    const body: Record<string, unknown> = { name };
    if (data !== undefined) body.data = data;
    if (firstRowHeader !== undefined) body.first_row_header = firstRowHeader;
    return this.request("POST", `/api/database/tables/database/${databaseId}/`, { body });
  }

  async deleteTable(tableId: number) {
    return this.request("DELETE", `/api/database/tables/${tableId}/`);
  }

  async listFields(tableId: number) {
    return this.request<unknown[]>(
      "GET",
      `/api/database/fields/table/${tableId}/`,
    );
  }

  async createField(tableId: number, name: string, type: string, fieldOptions?: Record<string, unknown>) {
    const body: Record<string, unknown> = { name, type };
    if (fieldOptions) {
      Object.assign(body, fieldOptions);
    }
    return this.request("POST", `/api/database/fields/table/${tableId}/`, { body });
  }

  async updateField(fieldId: number, updates: Record<string, unknown>) {
    return this.request("PATCH", `/api/database/fields/${fieldId}/`, { body: updates });
  }

  async deleteField(fieldId: number) {
    return this.request("DELETE", `/api/database/fields/${fieldId}/`);
  }

  // ──────────────────────────────────────────────
  // Data - Rows
  // ──────────────────────────────────────────────

  async listRows(
    tableId: number,
    params: {
      page?: number;
      size?: number;
      search?: string;
      orderBy?: string;
      userFieldNames?: boolean;
    } = {},
  ) {
    return this.request("GET", `/api/database/rows/table/${tableId}/`, {
      query: {
        page: params.page,
        size: params.size,
        search: params.search,
        order_by: params.orderBy,
        user_field_names: params.userFieldNames !== false ? "true" : undefined,
      },
    });
  }

  async createRow(tableId: number, data: Record<string, unknown>) {
    return this.request("POST", `/api/database/rows/table/${tableId}/`, {
      body: data,
      query: { user_field_names: "true" },
    });
  }

  async updateRow(tableId: number, rowId: number, data: Record<string, unknown>) {
    return this.request("PATCH", `/api/database/rows/table/${tableId}/${rowId}/`, {
      body: data,
      query: { user_field_names: "true" },
    });
  }

  async deleteRow(tableId: number, rowId: number) {
    return this.request("DELETE", `/api/database/rows/table/${tableId}/${rowId}/`);
  }

  async batchCreateRows(tableId: number, items: Record<string, unknown>[]) {
    return this.request("POST", `/api/database/rows/table/${tableId}/batch/`, {
      body: { items },
      query: { user_field_names: "true" },
    });
  }

  async batchUpdateRows(tableId: number, items: Record<string, unknown>[]) {
    return this.request("PATCH", `/api/database/rows/table/${tableId}/batch/`, {
      body: { items },
      query: { user_field_names: "true" },
    });
  }

  async batchDeleteRows(tableId: number, items: number[]) {
    return this.request("POST", `/api/database/rows/table/${tableId}/batch-delete/`, {
      body: { items },
    });
  }
}
