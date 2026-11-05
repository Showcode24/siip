/**
 * Generates the OpenAPI 3.1 spec from the route handlers and their Zod schemas.
 *   pnpm openapi
 * Writes src/server/openapi/openapi.json (served at /api/v1/openapi.json) and
 * refreshes the endpoint table in README.md.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

const ROOT = path.resolve(import.meta.dirname, "..");
const API_DIR = path.join(ROOT, "app/api/v1");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

type Role =
  "PUBLIC" | "ANY_USER" | "GRADUATE" | "COMPANY_MEMBER" | "COMPANY_OWNER" | "ADMIN" | "SUPER_ADMIN" | "CRON";

interface Endpoint {
  method: (typeof METHODS)[number];
  path: string;
  tag: string;
  role: Role;
  summary: string;
  body?: { name: string; module: string };
  query?: { name: string; module: string };
  csv: boolean;
  created: boolean;
}

function routeFiles(): string[] {
  return (readdirSync(API_DIR, { recursive: true }) as string[])
    .filter((f) => f.endsWith("route.ts"))
    .map((f) => path.join(API_DIR, f));
}

function roleOf(block: string): Role {
  if (block.includes("requireCronSecret")) return "CRON";
  if (block.includes("requireSuperAdmin")) return "SUPER_ADMIN";
  if (block.includes("requireAdmin")) return "ADMIN";
  if (block.includes("requireGraduate")) return "GRADUATE";
  if (/requireCompanyMember\(req,\s*\{\s*ownerOnly: true/.test(block)) return "COMPANY_OWNER";
  if (block.includes("requireCompanyMember") || block.includes('roles: ["COMPANY_MEMBER"]'))
    return "COMPANY_MEMBER";
  if (block.includes("requireUser")) return "ANY_USER";
  return "PUBLIC";
}

const sentence = (fn: string) =>
  fn
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/ ([A-Z])/g, (_, c) => ` ${c.toLowerCase()}`);

function parseRoute(file: string): Endpoint[] {
  const src = readFileSync(file, "utf8");
  const rel = path.relative(API_DIR, path.dirname(file)).split(path.sep).join("/");
  const apiPath = `/api/v1/${rel}`.replace(/\[(\w+)\]/g, "{$1}");
  const imports = new Map<string, string>();
  for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+"([^"]+)"/g)) {
    for (const name of m[1]
      .split(",")
      .map((n) => n.replace(/^type\s+/, "").trim())
      .filter(Boolean)) {
      imports.set(name, m[2]);
    }
  }
  const services = [...imports].filter(([, from]) => from.startsWith("@/server/services/")).map(([n]) => n);
  const blocks = src.split(/(?=export const (?:GET|POST|PUT|PATCH|DELETE) =)/);
  return blocks.flatMap((block) => {
    const method = /^export const (GET|POST|PUT|PATCH|DELETE) =/.exec(block)?.[1] as
      Endpoint["method"] | undefined;
    if (!method) return [];
    const schemaRef = (re: RegExp) => {
      const name = re.exec(block)?.[1];
      const from = name ? imports.get(name) : undefined;
      return name && from ? { name, module: from } : undefined;
    };
    const fn = services.find((s) => block.includes(`${s}(`));
    return [
      {
        method,
        path: apiPath,
        tag: rel.split("/")[0],
        role: roleOf(block),
        summary: fn ? sentence(fn) : `${method} ${apiPath}`,
        body: schemaRef(/parseJson\(req,\s*(\w+)\)/),
        query: schemaRef(/parseQuery\(req,\s*(\w+)\)/),
        csv: block.includes("csvResponse"),
        created: /return created\(/.test(block),
      },
    ];
  });
}

async function loadSchema(ref: { name: string; module: string }): Promise<z.ZodType> {
  const file = path.join(ROOT, "src", ref.module.replace(/^@\//, "")) + ".ts";
  const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
  const schema = mod[ref.name];
  if (!(schema instanceof z.ZodType)) throw new Error(`${ref.name} in ${ref.module} is not a Zod schema`);
  return schema;
}

const toJson = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: "input", unrepresentable: "any", target: "draft-2020-12" }) as Record<
    string,
    unknown
  >;

const ROLE_TEXT: Record<Role, string> = {
  PUBLIC: "Public",
  ANY_USER: "Any signed-in user",
  GRADUATE: "Graduate",
  COMPANY_MEMBER: "Company member",
  COMPANY_OWNER: "Company owner",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super admin",
  CRON: "Cron (secret)",
};

async function main() {
  const endpoints = routeFiles()
    .flatMap(parseRoute)
    .sort((a, b) => a.path.localeCompare(b.path) || METHODS.indexOf(a.method) - METHODS.indexOf(b.method));

  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of endpoints) {
    const parameters: unknown[] = [...e.path.matchAll(/\{(\w+)\}/g)].map((m) => ({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "string" },
    }));
    if (e.query) {
      const json = toJson(await loadSchema(e.query));
      const props = (json.properties ?? {}) as Record<string, unknown>;
      const required = new Set((json.required as string[] | undefined) ?? []);
      for (const [name, schema] of Object.entries(props)) {
        parameters.push({ name, in: "query", required: required.has(name), schema });
      }
    }
    const success = e.csv
      ? { description: "CSV file", content: { "text/csv": { schema: { type: "string" } } } }
      : {
          description: "Success",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } },
        };
    paths[e.path] ??= {};
    paths[e.path][e.method.toLowerCase()] = {
      tags: [e.tag],
      summary: e.summary,
      description: `Access: ${ROLE_TEXT[e.role]}.`,
      "x-roles": e.role,
      security: e.role === "PUBLIC" ? [] : e.role === "CRON" ? [{ cronSecret: [] }] : [{ sessionCookie: [] }],
      ...(parameters.length ? { parameters } : {}),
      ...(e.body
        ? {
            requestBody: {
              required: true,
              content: { "application/json": { schema: toJson(await loadSchema(e.body)) } },
            },
          }
        : {}),
      responses: {
        [e.created ? "201" : "200"]: success,
        default: {
          description: "Error",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } },
        },
      },
    };
  }

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "SIIP API",
      version: "1.0.0",
      description:
        "Every JSON response is { data, error, meta }. Errors carry a code, a safe message and optional details. " +
        "List endpoints use cursor pagination: pass meta.nextCursor back as ?cursor=.",
    },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        sessionCookie: { type: "apiKey", in: "cookie", name: "better-auth.session_token" },
        cronSecret: { type: "http", scheme: "bearer" },
      },
      schemas: {
        Envelope: {
          type: "object",
          required: ["data", "error", "meta"],
          properties: {
            data: {},
            error: {
              type: ["object", "null"],
              properties: { code: { type: "string" }, message: { type: "string" }, details: {} },
            },
            meta: { type: ["object", "null"] },
          },
        },
      },
    },
    paths,
  };
  writeFileSync(path.join(ROOT, "src/server/openapi/openapi.json"), JSON.stringify(spec, null, 2) + "\n");

  const table = [
    "| Method | Path | Access | Purpose |",
    "|---|---|---|---|",
    ...endpoints.map((e) => `| ${e.method} | \`${e.path}\` | ${ROLE_TEXT[e.role]} | ${e.summary} |`),
  ].join("\n");
  const readmePath = path.join(ROOT, "README.md");
  const readme = readFileSync(readmePath, "utf8");
  const updated = readme.replace(
    /<!-- endpoints:start -->[\s\S]*<!-- endpoints:end -->/,
    `<!-- endpoints:start -->\n${table}\n<!-- endpoints:end -->`,
  );
  writeFileSync(readmePath, updated);
  console.log(`OpenAPI: ${endpoints.length} operations across ${Object.keys(paths).length} paths`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
