# Status Tracker

Internal uptime/status tracker that runs entirely on Cloudflare Workers (public status page +
protected admin UI + a cron-driven checker), styled with Bootstrap 5. No external server or
database is required beyond Cloudflare D1.

- **HTTP monitors**: `fetch()`-based checks against a URL, success = response status inside a
  configurable range (default 200-399).
- **TCP monitors**: raw TCP connect checks against `host:port` using the Workers `cloudflare:sockets`
  API. Success = the connection opens within the configured timeout.
- Results are stored in D1 and used to compute 24h/7d/30d/90d uptime % and a 90-day daily history
  bar on the public status page, similar in spirit to an UptimeRobot public status page.

## Important limitation: TCP port checks and the Workers plan

Cloudflare Workers' outbound TCP Sockets API restricts which ports you can connect to depending on
your account's plan:

- **Free plan**: outbound TCP connections are only allowed to ports **80 and 443**.
- **Paid (Workers Paid/Enterprise) plan**: outbound TCP connections are allowed to arbitrary ports.

If you need to monitor arbitrary internal ports (databases, SSH, custom services), you need a paid
Workers plan for the TCP monitor type to work. HTTP monitors are unaffected by this restriction.

There is also no raw ICMP access in the Workers runtime, so this project intentionally does not
implement "ping" as a separate check type — use an HTTP or TCP check against the target instead.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create the D1 database:
   ```
   npx wrangler d1 create statuspage-db
   ```
   Copy the returned `database_id` into `wrangler.toml` (replace `REPLACE_WITH_YOUR_D1_DATABASE_ID`).

3. Apply the schema migration:
   ```
   npm run db:migrate:local    # for local `wrangler dev` testing
   npm run db:migrate:remote   # against the real Cloudflare D1 database
   ```

4. Set the admin token (protects `/admin` and the `/api/monitors` write endpoints):
   ```
   npx wrangler secret put ADMIN_TOKEN
   ```
   Pick a long random value; there is no username, just this bearer token.

5. Run locally:
   ```
   npm run dev
   ```
   Visit `http://localhost:8787/` for the public status page and `http://localhost:8787/admin` to
   add monitors. The scheduled checker doesn't run automatically under `wrangler dev`; trigger it
   manually with:
   ```
   curl "http://localhost:8787/cdn-cgi/handler/scheduled"
   ```
   For local admin testing, put `ADMIN_TOKEN=<some-value>` in a `.dev.vars` file (already
   git-ignored) so `wrangler dev` picks it up as the secret.

6. Deploy:
   ```
   npm run deploy
   ```
   The Worker is configured with a cron trigger (`*/1 * * * *`) that runs due checks and prunes
   check history older than 90 days every minute — no external scheduler needed.

## Usage

- Public status page: `/` — shows an overall status banner and per-monitor uptime history. No auth.
- Admin UI: `/admin` — paste the `ADMIN_TOKEN` value to unlock monitor management (add/edit/delete).
  The token is kept in the browser's `localStorage` and sent as `Authorization: Bearer <token>` on
  API calls.
- JSON API: `GET /api/status` (public), `GET/POST /api/monitors` and `PUT/DELETE
  /api/monitors/:id` (require the bearer token).

## Notes

- Each monitor's `interval_minutes` controls how often it's actually checked; the cron trigger runs
  every minute but only executes monitors whose interval has elapsed since their last check.
- Raw check history is kept for 90 days and pruned automatically; uptime percentages and the daily
  history bar are computed from that data at render time.
