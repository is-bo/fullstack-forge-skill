import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { discoverProject } from "../src/discovery.js";
import type { RouteRecord } from "../src/types.js";
import { withTemporaryProject } from "./helpers.js";

async function write(root: string, relative: string, content: string): Promise<void> {
  const target = join(root, relative);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function routesFor(name: string, files: Array<[string, string]>): Promise<RouteRecord[]> {
  let routes: RouteRecord[] = [];
  await withTemporaryProject(name, async (root) => {
    await write(root, "package.json", JSON.stringify({ name: "route-fixture" }, null, 2));
    for (const [path, content] of files) await write(root, path, content);
    routes = (await discoverProject(root)).routes;
  });
  return routes;
}

test("Next.js App Router route handlers are detected", async () => {
  const routes = await routesFor("routes-next-app", [
    [
      "app/orders/route.ts",
      "export async function GET() { return Response.json([]); }\nexport async function POST() { return Response.json({}); }\n"
    ]
  ]);
  const names = routes.map((route) => route.name);
  assert.ok(names.includes("GET /orders"), `expected GET /orders, got ${names.join(", ")}`);
  assert.ok(names.includes("POST /orders"));
  assert.ok(
    routes.every((route) => route.evidence.some((item) => item.includes("nextjs-app-router"))),
    "each record must name the adapter that produced it"
  );
});

test("Next.js Pages Router API routes are detected", async () => {
  const routes = await routesFor("routes-next-pages", [
    ["pages/api/users.ts", "export default function handler(req, res) { res.json([]); }\n"]
  ]);
  assert.ok(routes.some((route) => route.name === "ROUTE /api/users"));
});

test("NestJS controller decorators are detected with the controller base path", async () => {
  const routes = await routesFor("routes-nest", [
    [
      "src/orders.controller.ts",
      `@Controller("orders")
export class OrdersController {
  @Get(":id")
  findOne() { return null; }
  @Post()
  create() { return null; }
}
`
    ]
  ]);
  const names = routes.map((route) => route.name);
  assert.ok(names.includes("GET /orders/:id"), `got ${names.join(", ")}`);
  assert.ok(names.includes("POST /orders"));
});

test("Fastify object-form route registration is detected", async () => {
  const routes = await routesFor("routes-fastify", [
    [
      "server.ts",
      `fastify.route({\n  method: "DELETE",\n  url: "/sessions/:id",\n  handler: async () => ({})\n});\n`
    ]
  ]);
  assert.ok(routes.some((route) => route.name === "DELETE /sessions/:id"));
});

test("framework routes do not claim a visibility that middleware may control", async () => {
  const routes = await routesFor("routes-visibility", [
    ["app/admin/route.ts", "export async function GET() { return Response.json([]); }\n"]
  ]);
  const route = routes.find((candidate) => candidate.name === "GET /admin");
  assert.ok(route !== undefined);
  assert.equal(
    route.visibility,
    "unknown",
    "an adapter that cannot see the middleware chain must not assert visibility"
  );
  assert.ok(route.evidence.some((item) => item.includes("middleware-inherited")));
});

test("a route named /login is not asserted public at high confidence", async () => {
  const routes = await routesFor("routes-login-heuristic", [
    ["server.ts", `app.post("/login", (req, res) => res.json({}));\n`]
  ]);
  const route = routes.find((candidate) => candidate.name === "POST /login");
  assert.ok(route !== undefined);
  assert.equal(
    route.confidence,
    "LOW",
    "name-based visibility is a heuristic and must be reported at low confidence"
  );
  assert.ok(
    route.evidence.some((item) => item.includes("inferred from the route name")),
    "the heuristic must be disclosed in the evidence"
  );
});

test("an Express route with a visible guard keeps high confidence", async () => {
  const routes = await routesFor("routes-guarded", [
    ["server.ts", `app.get("/orders", requireAuth, (req, res) => res.json([]));\n`]
  ]);
  const route = routes.find((candidate) => candidate.name === "GET /orders");
  assert.ok(route !== undefined);
  assert.equal(route.visibility, "authenticated");
  assert.equal(route.confidence, "HIGH");
});
