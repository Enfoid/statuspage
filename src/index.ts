import { Hono } from "hono";
import {
  createMonitor,
  deleteMonitor,
  getAllMonitorStatuses,
  getDueMonitors,
  insertCheck,
  listMonitors,
  pruneOldChecks,
  updateMonitor,
  type MonitorInput,
} from "./db";
import { runCheck } from "./checks";
import { requireAdmin } from "./auth";
import { renderStatusPage } from "./render/status";
import { renderAdminPage } from "./render/admin";

export interface Env {
  DB: D1Database;
  ADMIN_TOKEN: string;
}

const app = new Hono<{ Bindings: Env }>();

function validateMonitorInput(body: any): { error: string } | { value: MonitorInput } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  if (typeof body.name !== "string" || !body.name.trim()) return { error: "name is required" };
  if (body.type !== "http" && body.type !== "tcp") return { error: "type must be 'http' or 'tcp'" };
  if (typeof body.target !== "string" || !body.target.trim()) return { error: "target is required" };
  if (body.type === "tcp" && (!Number.isInteger(body.port) || body.port <= 0 || body.port > 65535)) {
    return { error: "a valid port (1-65535) is required for tcp monitors" };
  }
  return {
    value: {
      name: body.name.trim(),
      type: body.type,
      target: body.target.trim(),
      port: body.type === "tcp" ? body.port : null,
      interval_minutes: Number.isFinite(body.interval_minutes) && body.interval_minutes >= 1 ? body.interval_minutes : 5,
      timeout_ms: Number.isFinite(body.timeout_ms) && body.timeout_ms >= 500 ? body.timeout_ms : 10000,
      expected_status_min: Number.isFinite(body.expected_status_min) ? body.expected_status_min : 200,
      expected_status_max: Number.isFinite(body.expected_status_max) ? body.expected_status_max : 399,
      enabled: body.enabled !== false,
      sort_order: Number.isFinite(body.sort_order) ? body.sort_order : 0,
    },
  };
}

app.get("/", async (c) => {
  const statuses = await getAllMonitorStatuses(c.env.DB);
  return c.html(renderStatusPage(statuses));
});

app.get("/admin", (c) => c.html(renderAdminPage()));

app.get("/api/status", async (c) => {
  const statuses = await getAllMonitorStatuses(c.env.DB);
  return c.json(statuses);
});

app.get("/api/monitors", requireAdmin, async (c) => {
  const monitors = await listMonitors(c.env.DB);
  return c.json(monitors);
});

app.post("/api/monitors", requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = validateMonitorInput(body);
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const monitor = await createMonitor(c.env.DB, parsed.value);
  return c.json(monitor, 201);
});

app.put("/api/monitors/:id", requireAdmin, async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
  const body = await c.req.json().catch(() => null);
  const parsed = validateMonitorInput(body);
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const monitor = await updateMonitor(c.env.DB, id, parsed.value);
  if (!monitor) return c.json({ error: "Not found" }, 404);
  return c.json(monitor);
});

app.delete("/api/monitors/:id", requireAdmin, async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
  await deleteMonitor(c.env.DB, id);
  return c.body(null, 204);
});

async function runDueChecks(env: Env): Promise<void> {
  const due = await getDueMonitors(env.DB);
  await Promise.allSettled(
    due.map(async (monitor) => {
      const result = await runCheck(monitor);
      await insertCheck(env.DB, monitor.id, result);
    })
  );
  await pruneOldChecks(env.DB);
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runDueChecks(env));
  },
};
