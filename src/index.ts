/**
 * MCP Server entry point for Baserow with 2FA authentication.
 * Handles ListToolsRequestSchema and CallToolRequestSchema via StdioServerTransport.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BaserowAuth } from "./auth.js";
import { BaserowApiClient } from "./api.js";
import { registerTools } from "./tools.js";

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
  version: "1.0.0",
});

// Register all 15 tools
registerTools(server, api, auth);

// ── Start ──────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now running on stdio - MCP protocol handles communication
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err.message}\n`);
  process.exit(1);
});
