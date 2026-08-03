# mcp-baserow-schema

MCP server for Baserow that provides **schema management** with **2FA authentication** (TOTP).

Built for workflows where schema changes (adding/removing/modifying fields and tables) must be automated — not manual. Pairs with Baserow's official MCP (data-only) for full coverage.

## Why

Baserow's official MCP handles **data CRUD** but not **schema changes**. In 2026, plain password auth without2FA is not acceptable. This MCP solves both:

- **Schema operations**: create/update/delete fields and tables via MCP tools
- **2FA support**: automatic TOTP-based authentication — no manual token management
- **Designed for agents**: AI agents can modify table structure without human intervention

## Authentication

Supports Baserow's two-step2FA flow:

1. `POST /api/user/token-auth/` → temporary2FA token
2. `POST /api/two-factor-auth/verify/` → JWT access token (with TOTP code)

JWT is auto-refreshed. Credentials are passed via environment variables — never hardcoded.

## Tools (16)

| Category | Tool | Description |
|---|---|---|
| **Discovery** | `list_databases` | List databases in a workspace |
| | `list_tables` | List tables in a database |
| **Schema** | `create_table` | Create a new table |
| | `delete_table` | Delete a table |
| | `list_fields` | List fields (columns) in a table |
| | `create_field` | Create a new field |
| | `update_field` | Update an existing field |
| | `delete_field` | Delete a field |
| **Data** | `list_rows` | List rows with pagination/search/sort |
| | `create_row` | Create a single row |
| | `update_row` | Update a single row |
| | `delete_row` | Delete a single row |
| | `batch_create_rows` | Create multiple rows (up to 200) |
| | `batch_update_rows` | Update multiple rows (up to 200) |
| | `batch_delete_rows` | Delete multiple rows (up to 200) |
| **Auth** | `auth_status` | Check authentication state |

## Setup

### Prerequisites

- Node.js ≥ 20
- Baserow account with2FA enabled
- Baserow TOTP secret (base32)

### Install

```bash
git clone git@github.com:aficiomaquinas/mcp-baserow-schema.git
cd mcp-baserow-schema
npm install
npm run build
```

### Configure

Set environment variables (or use a `.env` file):

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

The `create_field` and `update_field` tools support all Baserow field types:

`text`, `long_text`, `url`, `email`, `number`, `rating`, `boolean`, `date`, `last_modified`, `last_modified_by`, `created_on`, `created_by`, `duration`, `link_row`, `file`, `single_select`, `multiple_select`, `phone_number`, `formula`, `count`, `rollup`, `lookup`, `multiple_collaborators`, `uuid`, `autonumber`, `password`, `ai`

## Usage with Official Baserow MCP

Use both MCPs together:

- **Official Baserow MCP** → data operations (optimized for row CRUD)
- **mcp-baserow-schema** → schema operations (fields, tables, structure)

This separation keeps each tool focused and avoids conflicts.

## License

MIT
