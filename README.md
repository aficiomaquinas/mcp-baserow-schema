# mcp-baserow-schema

MCP server for Baserow: a **generic Baserow API client** with **2FA authentication** (TOTP) and **OpenAPI validation**.

One tool, the entire Baserow REST API. Schema changes (tables, fields, views, filters), row CRUD, workspace admin — anything documented in the OpenAPI spec is callable, with JWT auth handled automatically.

> **v2.0.0 (breaking)**: the 16 hardcoded tools from v1 were replaced by a single generic `baserow_api` tool. See the [changelog note](#migrating-from-v1) below.

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
      BASEROW_API_URL: https://baserow.ttamayo.com
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
        "BASEROW_API_URL": "https://baserow.ttamayo.com",
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

## Migrating from v1

The 16 dedicated tools (`list_databases`, `create_field`, `batch_create_rows`, ...) no longer exist. Map old calls to `baserow_api`:

| v1 tool | v2 equivalent |
|---|---|
| `list_databases` | `baserow_api` GET `/api/applications/workspace/{workspace_id}/` |
| `list_tables` | `baserow_api` GET `/api/database/tables/database/{database_id}/` |
| `list_fields` | `baserow_api` GET `/api/database/fields/table/{table_id}/` |
| `create_field` / `update_field` / `delete_field` | `baserow_api` POST/PATCH/DELETE `/api/database/fields/table/{table_id}/...` |
| `create_table` / `delete_table` | `baserow_api` POST `/api/database/tables/database/{database_id}/` · DELETE `/api/database/tables/{table_id}/` |
| `list_rows` | `baserow_api` GET `/api/database/rows/table/{table_id}/` (+ `?page=&size=&search=&order_by=`) |
| `create_row` / `update_row` / `delete_row` | `baserow_api` POST/PATCH/DELETE `/api/database/rows/table/{table_id}/...` |
| `batch_create_rows` / `batch_update_rows` | `baserow_api` POST/PATCH `/api/database/rows/table/{table_id}/batch/` |
| `batch_delete_rows` | `baserow_api` POST `/api/database/rows/table/{table_id}/batch-delete/` |
| `auth_status` | unchanged |

Batch limits are no longer hardcoded — Baserow's own API limits apply (e.g. 200 items per batch call).

## Releasing

Releases are fully automated with [release-it](https://github.com/release-it/release-it) — **never bump versions, tags, or `server.json` manually**. The bump is derived from [Conventional Commits](https://www.conventionalcommits.org/) since the last tag:

- `fix:` → patch · `feat:` → minor · `feat!:` / `BREAKING CHANGE:` → major

```bash
pnpm run release          # interactive release
pnpm run release:dry-run  # preview the whole plan, changes nothing
```

One command does everything: rebuilds `dist/` → bumps `package.json` **and both `version` fields in `server.json`** (`@release-it/bumper`) → generates `CHANGELOG.md` from commits (`@release-it/conventional-changelog`) → commits `chore(release): x.y.z` → tags `vx.y.z` → pushes → `npm publish`.

After the npm publish succeeds, update the MCP Registry (metadata only, requires `mcp-publisher login github` when the token expired):

```bash
mcp-publisher publish server.json
```

## License

MIT
