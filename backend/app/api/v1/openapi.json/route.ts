import spec from "@/server/openapi/openapi.json";

// Public API description (OpenAPI 3.1). Regenerate with `pnpm openapi`.
export const GET = () => Response.json(spec, { headers: { "cache-control": "public, max-age=300" } });
