#!/usr/bin/env node
/**
 * MCP Server entry point for Baserow with 2FA authentication.
 *
 * Exposes two tools:
 *  - `baserow_api`: Generic HTTP client for any Baserow API endpoint
 *  - `auth_status`: Debug auth state
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { BaserowAuth } from "./auth.js";
import { BaserowApiClient } from "./api.js";
import { validateEndpoint } from "./spec.js";

// Package version, read from package.json at the repo/package root
const { version: PKG_VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { version: string };

// ── Environment variables ──────────────────────────

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const API_URL = getEnv("BASEROW_API_URL");
const USERNAME = getEnv("BASEROW_USERNAME");
const PASSWORD = getEnv("BASEROW_PASSWORD");
const TOTP_SECRET = getEnv("BASEROW_TOTP_SECRET");

// ── Initialize ─────────────────────────────────────

const auth = new BaserowAuth({
  apiUrl: API_URL,
  username: USERNAME,
  password: PASSWORD,
  totpSecret: TOTP_SECRET,
});

const api = new BaserowApiClient(auth, API_URL);

// ── MCP Server ─────────────────────────────────────

const server = new McpServer({
  name: "mcp-baserow",
  version: PKG_VERSION,
});

// ── Tool: baserow_api ──────────────────────────────

server.tool(
  "baserow_api",
  `Generic Baserow API client. Call ANY Baserow endpoint with method, path, body, and query params.

Examples:
  GET  /api/database/tables/database/357/                          → list tables
  POST /api/database/views/table/965/  {name, type}                → create view
  POST /api/database/views/4029/filters/  {field, type, value}     → create filter
  DELETE /api/database/tables/968/                                 → delete table
  PATCH /api/database/rows/table/965/11/  {status}  ?user_field_names=true → update row
  POST /api/database/rows/table/965/batch/  {items:[...]}         → batch update

Auth is handled automatically. Just provide the method, path, and optional body/query.`,
  {
    method: z.enum(["GET", "POST", "PATCH", "DELETE", "PUT"]).describe("HTTP method"),
    path: z.string().describe('API path starting with /api/. Example: "/api/database/tables/database/357/"'),
    body: z.any().optional().describe("JSON body for POST/PATCH/PUT requests"),
    query: z.record(z.string()).optional().describe('Query parameters as key-value pairs. Example: {"page": "1", "size": "100", "user_field_names": "true"}'),
  },
  async (args) => {
    try {
      // Validate against OpenAPI spec (non-blocking — warns only)
      const validation = validateEndpoint(args.method, args.path);

      const resp = await api.request(args.method, args.path, {
        body: args.body,
        query: args.query,
      });

      // Prepend spec warning if path wasn't found
      let output = JSON.stringify(resp.data, null, 2);
      if (!validation.found && validation.hint) {
        output = `⚠️ OpenAPI spec: ${validation.hint}\n\n` + output;
      }

      return {
        content: [{ type: "text" as const, text: output }],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
);

// ── Tool: auth_status ──────────────────────────────

server.tool(
  "auth_status",
  "Check the current authentication state including email, user ID, and token expiry.",
  {},
  async () => {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(auth.getStatus(), null, 2) }],
    };
  },
);

// ── Start ──────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err.message}\n`);
  process.exit(1);
});
