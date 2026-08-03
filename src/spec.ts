/**
 * OpenAPI spec loader for Baserow.
 * Validates that a given path+method exists in the spec.
 * Uses a bundled copy of the spec at build time.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

interface OpenApiPathItem {
  get?: { summary?: string };
  post?: { summary?: string };
  patch?: { summary?: string };
  delete?: { summary?: string };
  put?: { summary?: string };
}

interface OpenApiSpec {
  paths: Record<string, OpenApiPathItem>;
}

let _spec: OpenApiSpec | null = null;

function loadSpec(): OpenApiSpec {
  if (_spec) return _spec;

  // __dirname equivalent for ESM
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Try dist/ first (built), then project root
  const candidates = [
    join(__dirname, "..", "openapi.json"),
    join(__dirname, "openapi.json"),
  ];

  for (const p of candidates) {
    try {
      const raw = readFileSync(p, "utf-8");
      _spec = JSON.parse(raw) as OpenApiSpec;
      return _spec;
    } catch {
      continue;
    }
  }

  // Spec not found — return empty so validation is skipped gracefully
  return { paths: {} };
}

/**
 * Normalize an OpenAPI path template like /api/database/rows/table/{table_id}/{row_id}/
 * to a regex that matches numeric IDs. Also handles {uuid} style params.
 */
function pathToRegex(template: string): RegExp {
  // Replace {param} with a capture group for numbers or UUIDs
  const pattern = template
    .replace(/\{[^}]+\}/g, "[^/]+")
    .replace(/\//g, "\\/");
  return new RegExp("^" + pattern + "\\/?$");
}

/**
 * Check if a path+method is documented in the Baserow OpenAPI spec.
 * Returns null if found, or a suggestion string if not.
 */
export function validateEndpoint(
  method: string,
  path: string,
): { found: boolean; hint?: string } {
  const spec = loadSpec();
  const normalizedPath = path.replace(/\/+$/, "") + "/";

  // Direct match
  if (spec.paths[normalizedPath]) {
    const item = spec.paths[normalizedPath];
    const methodLower = method.toLowerCase() as keyof OpenApiPathItem;
    if (item[methodLower]) {
      return { found: true };
    }
    // Path exists but method doesn't
    const available = Object.keys(item)
      .filter((m) => m !== "parameters")
      .join(", ");
    return {
      found: false,
      hint: `Path exists but ${method} is not supported. Available methods: ${available}`,
    };
  }

  // Try regex match against path templates
  for (const [template, item] of Object.entries(spec.paths)) {
    const regex = pathToRegex(template);
    if (regex.test(normalizedPath)) {
      const methodLower = method.toLowerCase() as keyof OpenApiPathItem;
      if (item[methodLower]) {
        return { found: true };
      }
      const available = Object.keys(item)
        .filter((m) => m !== "parameters")
        .join(", ");
      return {
        found: false,
        hint: `Path matches template "${template}" but ${method} is not supported. Available methods: ${available}`,
      };
    }
  }

  // Not found at all — suggest similar paths
  const allPaths = Object.keys(spec.paths);
  const segments = normalizedPath.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];

  // Find paths that share the same root segments
  const rootPrefix = "/" + segments.slice(0, Math.max(3, segments.length - 1)).join("/") + "/";
  const similar = allPaths
    .filter((p) => p.startsWith(rootPrefix) || p.includes(lastSegment))
    .slice(0, 5);

  let hint = `Path "${path}" not found in Baserow OpenAPI spec.`;
  if (similar.length > 0) {
    hint += ` Similar paths:\n${similar.map((p) => "  " + p).join("\n")}`;
  }

  return { found: false, hint };
}
