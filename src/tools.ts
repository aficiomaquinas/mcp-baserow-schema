/**
 * MCP tool definitions and handlers for Baserow.
 * Defines 15 tools covering discovery, schema, data, and auth operations.
 * Uses Zod schemas for the MCP SDK's tool() registration.
 */
import { z } from "zod";
import type { BaserowApiClient } from "./api.js";
import type { BaserowAuth } from "./auth.js";

/**
 * Register all tools on the MCP server.
 */
export function registerTools(
  server: any,
  api: BaserowApiClient,
  auth: BaserowAuth,
): void {
  // ──────────────────────────────────────────────
  // Discovery
  // ──────────────────────────────────────────────

  server.tool(
    "list_databases",
    "List all databases (applications) in a workspace. Returns database id, name, and type. Use workspace_id=1 for the default workspace.",
    { workspace_id: z.number().describe("The workspace ID to list databases from. Use 1 for the default workspace.") },
    async (args: any) => {
      const resp = await api.listDatabases(args.workspace_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(resp.data, null, 2) }] };
    },
  );

  server.tool(
    "list_tables",
    "List all tables in a database. Returns table id, name, order, and other metadata.",
    { database_id: z.number().describe("The database (application) ID to list tables from.") },
    async (args: any) => {
      const resp = await api.listTables(args.database_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(resp.data, null, 2) }] };
    },
  );

  // ──────────────────────────────────────────────
  // Schema
  // ──────────────────────────────────────────────

  server.tool(
    "create_table",
    "Create a new table in a database. Optionally provide initial data rows.",
    {
      database_id: z.number().describe("The database ID to create the table in."),
      name: z.string().describe("The name for the new table (max 255 chars)."),
      data: z.array(z.any()).optional().describe("Optional initial rows. Each row is an array of values in field order."),
      first_row_header: z.boolean().optional().describe("If true, the first row of data is used as field names. Default: false."),
    },
    async (args: any) => {
      const resp = await api.createTable(args.database_id, args.name, args.data, args.first_row_header);
      return { content: [{ type: "text" as const, text: JSON.stringify(resp.data, null, 2) }] };
    },
  );

  server.tool(
    "delete_table",
    "Delete a table by ID. This action is irreversible and will delete all fields and rows.",
    { table_id: z.number().describe("The table ID to delete.") },
    async (args: any) => {
      await api.deleteTable(args.table_id);
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }] };
    },
  );

  server.tool(
    "list_fields",
    "List all fields (columns) in a table with their types and options.",
    { table_id: z.number().describe("The table ID to list fields for.") },
    async (args: any) => {
      const resp = await api.listFields(args.table_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(resp.data, null, 2) }] };
    },
  );

  server.tool(
    "create_field",
    "Create a new field (column) in a table. The 'type' parameter must be one of: text, long_text, url, email, number, rating, boolean, date, last_modified, last_modified_by, created_on, created_by, duration, link_row, file, single_select, multiple_select, phone_number, formula, count, rollup, lookup, multiple_collaborators, uuid, autonumber, password, ai.",
    {
      table_id: z.number().describe("The table ID to add the field to."),
      name: z.string().describe("The name for the new field (max 255 chars)."),
      type: z.string().describe("The field type. Common types: text, long_text, number, boolean, date, single_select, multiple_select, link_row, url, email, phone_number, formula, rating, duration, file, uuid, autonumber."),
      field_options: z.record(z.any()).optional().describe("Optional type-specific field configuration (e.g., {text_default: 'hello', description: 'desc'})."),
    },
    async (args: any) => {
      const resp = await api.createField(args.table_id, args.name, args.type, args.field_options);
      return { content: [{ type: "text" as const, text: JSON.stringify(resp.data, null, 2) }] };
    },
  );

  server.tool(
    "update_field",
    "Update an existing field's name, type, or type-specific options.",
    {
      field_id: z.number().describe("The field ID to update."),
      name: z.string().optional().describe("New name for the field (optional)."),
      type: z.string().optional().describe("New field type (optional)."),
      field_options: z.record(z.any()).optional().describe("Optional type-specific options to update."),
    },
    async (args: any) => {
      const updates: Record<string, unknown> = {};
      if (args.name !== undefined) updates.name = args.name;
      if (args.type !== undefined) updates.type = args.type;
      if (args.field_options) Object.assign(updates, args.field_options);
      const resp = await api.updateField(args.field_id, updates);
      return { content: [{ type: "text" as const, text: JSON.stringify(resp.data, null, 2) }] };
    },
  );

  server.tool(
    "delete_field",
    "Delete a field (column) from a table. This will remove all data in that field.",
    { field_id: z.number().describe("The field ID to delete.") },
    async (args: any) => {
      await api.deleteField(args.field_id);
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }] };
    },
  );

  // ──────────────────────────────────────────────
  // Data - Rows
  // ──────────────────────────────────────────────

  server.tool(
    "list_rows",
    "List rows from a table with pagination, search, and sorting. Returns field values using human-readable field names by default.",
    {
      table_id: z.number().describe("The table ID to list rows from."),
      page: z.number().optional().describe("Page number (1-indexed). Default: 1."),
      size: z.number().optional().describe("Number of rows per page. Default: 100."),
      search: z.string().optional().describe("Search query to filter rows. Uses full-text search."),
      order_by: z.string().optional().describe('Comma-separated field names to sort by. Prefix with - for descending. Example: "Name,-Created On".'),
    },
    async (args: any) => {
      const resp = await api.listRows(args.table_id, {
        page: args.page,
        size: args.size,
        search: args.search,
        orderBy: args.order_by,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(resp.data, null, 2) }] };
    },
  );

  server.tool(
    "create_row",
    "Create a new row in a table. Provide field values as a JSON object with field names as keys. Uses human-readable field names.",
    {
      table_id: z.number().describe("The table ID to create the row in."),
      data: z.record(z.any()).describe('Field values as key-value pairs. Keys are field names (when using user_field_names=true). Example: {"Name": "Alice", "Email": "alice@example.com"}'),
    },
    async (args: any) => {
      const resp = await api.createRow(args.table_id, args.data);
      return { content: [{ type: "text" as const, text: JSON.stringify(resp.data, null, 2) }] };
    },
  );

  server.tool(
    "update_row",
    "Update an existing row in a table. Provide the row ID and the field values to update.",
    {
      table_id: z.number().describe("The table ID."),
      row_id: z.number().describe("The row ID to update."),
      data: z.record(z.any()).describe('Field values to update as key-value pairs. Example: {"Status": "Done"}'),
    },
    async (args: any) => {
      const resp = await api.updateRow(args.table_id, args.row_id, args.data);
      return { content: [{ type: "text" as const, text: JSON.stringify(resp.data, null, 2) }] };
    },
  );

  server.tool(
    "delete_row",
    "Delete a single row from a table by row ID.",
    {
      table_id: z.number().describe("The table ID."),
      row_id: z.number().describe("The row ID to delete."),
    },
    async (args: any) => {
      await api.deleteRow(args.table_id, args.row_id);
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }] };
    },
  );

  server.tool(
    "batch_create_rows",
    "Create multiple rows in a table at once (up to 200). Each item is a key-value object with field names.",
    {
      table_id: z.number().describe("The table ID."),
      items: z.array(z.record(z.any())).min(1).max(200).describe('Array of row objects, each with field name keys. Example: [{"Name": "Alice"}, {"Name": "Bob"}]'),
    },
    async (args: any) => {
      const resp = await api.batchCreateRows(args.table_id, args.items);
      return { content: [{ type: "text" as const, text: JSON.stringify(resp.data, null, 2) }] };
    },
  );

  server.tool(
    "batch_update_rows",
    "Update multiple rows at once (up to 200). Each item must include an 'id' field with the row ID, plus any fields to update.",
    {
      table_id: z.number().describe("The table ID."),
      items: z.array(z.record(z.any())).min(1).max(200).describe('Array of row objects. Each MUST have an "id" field. Example: [{"id": 1, "Status": "Done"}, {"id": 2, "Status": "Pending"}]'),
    },
    async (args: any) => {
      const resp = await api.batchUpdateRows(args.table_id, args.items);
      return { content: [{ type: "text" as const, text: JSON.stringify(resp.data, null, 2) }] };
    },
  );

  server.tool(
    "batch_delete_rows",
    "Delete multiple rows at once (up to 200) by providing an array of row IDs.",
    {
      table_id: z.number().describe("The table ID."),
      items: z.array(z.number()).min(1).max(200).describe("Array of row IDs to delete. Max 200."),
    },
    async (args: any) => {
      await api.batchDeleteRows(args.table_id, args.items);
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }] };
    },
  );

  // ──────────────────────────────────────────────
  // Auth
  // ──────────────────────────────────────────────

  server.tool(
    "auth_status",
    "Check the current authentication state including email, user ID, and token expiry.",
    {},
    async () => {
      return { content: [{ type: "text" as const, text: JSON.stringify(auth.getStatus(), null, 2) }] };
    },
  );
}
