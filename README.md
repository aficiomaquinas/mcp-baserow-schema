# mcp-baserow-schema

MCP server for Baserow: a **generic Baserow API client** with **2FA authentication** (TOTP) and **OpenAPI validation**.

One tool, the entire Baserow REST API. Schema changes (tables, fields, views, filters), row CRUD, workspace admin — anything documented in the OpenAPI spec is callable, with JWT auth handled automatically.

## Why

Baserow's official MCP handles curated **data CRUD** but not the full API surface (schema changes, views, filters, admin endpoints). In 2026, plain password auth without 2FA is not acceptable. This MCP solves both:

- **Full API access**: any endpoint from the bundled Baserow OpenAPI spec via one generic tool
- **2FA support**: automatic TOTP-based authentication — no manual token management
- **OpenAPI guard**: requests are validated against the spec; mistyped paths get a hint instead of a mystery 404
- **Designed for agents**: AI agents can modify table structure without human intervention

## Tools (2)

### `baserow_api`

Generic HTTP client for any Baserow API endpoint.

| Parameter | Type | Description |
|---|---|---|
| `method` | `GET` \| `POST` \| `PATCH` \| `DELETE` \| `PUT` | HTTP method |
| `path` | string | API path starting with `/api/` |
| `body` | object, optional | JSON body for POST/PATCH/PUT |
| `query` | object, optional | Query params as string key-value pairs |

Examples:

```
GET    /api/database/tables/database/123/                    → list tables in database 123
POST   /api/database/views/table/456/       {name, type}     → create view
POST   /api/database/views/789/filters/     {field, type, value} → create filter
DELETE /api/database/tables/456/                             → delete table
PATCH  /api/database/rows/table/456/11/    {status}   ?user_field_names=true → update row
POST   /api/database/rows/table/456/batch/ {items:[...]}      → batch update
```

Auth is handled automatically: just provide method, path, and optional body/query. If the OpenAPI spec doesn't recognize the path/method, the response is prefixed with a warning (`⚠️ OpenAPI spec: ...`) including similar paths — the request still executes (validation is non-blocking).

### `auth_status`

Returns the current authentication state: authenticated, token expiry, and remaining lifetime of access/refresh tokens. Useful for debugging the auth lifecycle.

## OpenAPI Validation

The server bundles the official Baserow OpenAPI spec (v2.2.2, 275 paths, `openapi.json` at the repo root). Before each request:

- **Path + method found** → request proceeds silently.
- **Path exists, method wrong** → warning lists the available methods for that path.
- **Path unknown** → warning plus up to 5 similar paths from the spec.

The spec is loaded lazily from `dist/../openapi.json`; if missing, validation is skipped gracefully and requests proceed unvalidated.

## Authentication

Supports Baserow's two-step 2FA flow:

1. `POST /api/user/token-auth/` → temporary 2FA token (~60 s)
2. `POST /api/two-factor-auth/verify/` (with TOTP code) → JWT access_token + refresh_token
3. `POST /api/user/token-refresh/` → new access_token, silently (no 2FA needed)

Token lifecycle:

- **access_token**: ~10 minutes (expiry read from the JWT `exp` claim, refreshed 2 min before expiry)
- **refresh_token**: ~7 days (full 2FA re-login 5 min before expiry)
- **temp_token**: ~60 seconds (only for the 2FA verify step)

Credentials are passed via environment variables — never hardcoded.

## Setup

### Prerequisites

- Node.js ≥ 20
- Baserow account with 2FA enabled
- Baserow TOTP secret (base32)

### Install

```bash
git clone git@github.com:aficiomaquinas/mcp-baserow-schema.git
cd mcp-baserow-schema
npm install
npm run build
```

### Configure

Set environment variables (or use a `.env` file — see `.env.example`):

```bash
BASEROW_API_URL=https://your-baserow-instance.com
BASEROW_USERNAME=you@example.com
BASEROW_PASSWORD=your_password
BASEROW_TOTP_SECRET=YOUR_BASE32_TOTP_SECRET
```

### Hermes Agent

Add to `~/.hermes/profiles/<profile>/config.yaml`:

```yaml
mcp_servers:
  baserow-mcp:
    command: node
    args:
      - /path/to/mcp-baserow-schema/dist/index.js
    enabled: true
    env:
      BASEROW_API_URL: https://baserow.example.com
      BASEROW_USERNAME: you@example.com
      BASEROW_PASSWORD: your_password
      BASEROW_TOTP_SECRET: YOUR_BASE32_TOTP_SECRET
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "baserow-schema": {
      "command": "node",
      "args": ["/path/to/mcp-baserow-schema/dist/index.js"],
      "env": {
        "BASEROW_API_URL": "https://baserow.example.com",
        "BASEROW_USERNAME": "you@example.com",
        "BASEROW_PASSWORD": "your_password",
        "BASEROW_TOTP_SECRET": "YOUR_BASE32_TOTP_SECRET"
      }
    }
  }
}
```

## Field Types

Since `baserow_api` is a pass-through client, **every Baserow field type** is supported — the JSON body just needs to match the API contract for the endpoint. Reference list of field types:

`text`, `long_text`, `url`, `email`, `number`, `rating`, `boolean`, `date`, `last_modified`, `last_modified_by`, `created_on`, `created_by`, `duration`, `link_row`, `file`, `single_select`, `multiple_select`, `phone_number`, `formula`, `count`, `rollup`, `lookup`, `multiple_collaborators`, `uuid`, `autonumber`, `password`, `ai`

Endpoint details: consult the bundled `openapi.json` or the [Baserow API docs](https://api.baserow.io/api/redoc/).

## Usage with Official Baserow MCP

Since v2, this MCP covers data operations too (rows, batches, search, sort), so the official Baserow MCP is **optional**:

- **mcp-baserow-schema** → everything: schema, data, views, filters, admin
- **Official Baserow MCP** → curated row-CRUD UX, if you prefer it for data work

Running both side by side is fine; they don't conflict.

## Releasing

Maintainers: see [docs/RELEASING.md](docs/RELEASING.md). Releases are fully automated (release-it + GitHub Actions with OIDC trusted publishing) — never bump versions, tags, or `server.json` manually.

## License

MIT
