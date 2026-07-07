import type { Context, Next } from "hono";
import type { Env } from "./index";

/** Constant-time-ish string compare to avoid trivial timing side-channels on the admin token. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function requireAdmin(c: Context<{ Bindings: Env }>, next: Next) {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!c.env.ADMIN_TOKEN || !token || !safeEqual(token, c.env.ADMIN_TOKEN)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
}
