# Poor Man's Uptime/Status Tracker

## Quick Disclaimer:
This was made for a single worker, but since this may be useful for others its public now,
because of the single use-nature, the database, some Names and a handful other things may be hardcoded on some places.
just fork it, and change the names accordingly and you good to go.

## Claude Sonnet 4.6 was used to deploy
i could not be arsed to figure out how this works (i'm a Digitalocean Apps guy)

using Cloudflare workers for this specific application comes with the **financial advantage of $0/Month**.

As long you stay below the limits, where the only true limit to worry about is the CPU time,
long waiting times and large monitor count can cause some hangups, wich will lead to long CPU times.
the batching fixed most of it, so you should be good for about 50+ Monitors.

Another example page can be found under [https://status.defunct.stream](https://status.defunct.stream)

## Summary
Internal uptime/status tracker that runs entirely on Cloudflare Workers (public status page +
protected admin UI + a cron-driven checker), styled with Bootstrap 5. No external server or
database is required beyond Cloudflare D1.

- **HTTP monitors**: `fetch()`-based checks against a URL, success = response status inside a
  configurable range (default 200-399), and — if an "expected content" string is set on the
  monitor — that string must also appear in the response body. This catches a request that
  returns 200 but is actually rendering an error page.
- **TCP monitors**: raw TCP connect checks against `host:port` using the Workers `cloudflare:sockets`
  API. Success = the connection opens within the configured timeout.
- Results are stored in D1 and used to compute 24h/7d/30d/90d uptime % and a 90-day daily history
  bar on the public status page, similar in spirit to an UptimeRobot public status page.
- The public status page and public API never expose a monitor's target/host/port — only the
  admin-assigned name, type, status, uptime %, and history are public. See "Privacy" below.
- Monitors can be paused from the admin UI: paused monitors are skipped by the checker and show a
  gray "N/A" badge publicly, while their historical numbers stay as they were.
- **Email alerts** (opt-in per monitor): one email when a monitor transitions down, one when it
  recovers — never repeated while it stays down, so a regularly-flaky host doesn't flood an inbox.
  Sent via the Cloudflare Email Routing `send_email` binding; see `CLAUDE.md` for the sender
  domain/destination setup this depends on.

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

## Privacy

Some monitored endpoints are internal/non-public. `GET /api/status` and the `/` status page only
ever return a redacted view of each monitor (`toPublicStatus` in `src/db.ts`): id, name, type,
up/down/paused/pending status, uptime percentages, average response time, and daily history. The
monitor's `target` (URL/hostname) and `port` are never included in that output — they only appear
in the admin-authenticated `GET /api/monitors` response, used to populate the edit form. The last
check's error message (e.g. "Unexpected status code 500") is shown publicly when a monitor is
down, but it never includes the target/host itself or the configured "expected content" string.

## Usage

- Public status page: `/` — shows an overall status banner and per-monitor uptime history. No auth.
- Admin UI: `/admin` — paste the `ADMIN_TOKEN` value to unlock monitor management (add/edit/delete).
  The token is kept in the browser's `localStorage` and sent as `Authorization: Bearer <token>` on
  API calls.
  - **Pause/resume**: the pause/play icon on each row toggles the monitor's `enabled` flag without
    opening the edit form — paused monitors stop being checked and show "N/A" publicly.
  - **Seed history**: the clock icon opens a dialog to backfill synthetic check history toward a
    target uptime % (useful right after adding a monitor, so it doesn't look brand new). It only
    overwrites data older than 1 hour, leaving real recent checks alone.
  - **Email alerts**: the "Email alerts on down/recovered" checkbox in the add/edit form opts that
    monitor into the down/recovered emails described above.
- JSON API: see [API Reference](#api-reference) below for every endpoint.

## API Reference

All authenticated routes require an `Authorization: Bearer <ADMIN_TOKEN>` header; a missing or
wrong token gets `401 { "error": "Unauthorized" }`. Unauthenticated routes have no such header.

### Monitor object fields

Shared by the request body of `POST`/`PUT /api/monitors` and the full `Monitor` shape returned by
the authenticated endpoints below.

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | required |
| `type` | `"http"` \| `"tcp"` | required |
| `target` | string | required — URL for `http`, hostname/IP for `tcp` |
| `port` | number | required (1-65535) when `type` is `tcp`; ignored for `http` |
| `interval_minutes` | number | default `5`; how often the cron actually checks this monitor |
| `timeout_ms` | number | default `10000`; minimum `500` |
| `expected_status_min` / `expected_status_max` | number | default `200` / `399`; `http` only |
| `expected_body` | string \| null | optional, `http` only — substring the response body must contain |
| `tags` | string \| null | comma-separated, e.g. `"prod,eu"` |
| `enabled` | boolean | default `true`; `false` pauses checking (shows "N/A" publicly) |
| `email_alerts` | boolean | default `false` — send an email on this monitor's down/recovered transitions, see "Email alerts" below |
| `sort_order` | number | default `0` |

### Public (unauthenticated)

- **`GET /api/status`** — optional `?tag=<tag>` filter (case-insensitive). Returns an array of
  redacted `PublicMonitorStatus` objects, the same data backing the `/` status page: `id`, `name`,
  `type`, `status` (`"up" | "down" | "pending" | "paused"`), `error` (only populated when down),
  `ignored`, `tags`, `uptime24h`/`uptime7d`/`uptime30d`/`uptime90d`, `avgResponseMs`, and `history`
  (90 entries of `{ date, total, up, uptime_pct }`). Never includes `target`/`port` — see Privacy.

- **`GET /api/internal/hosts`** — optional `?tag=<tag>` filter. Returns an array of `HostStatus`
  objects: `id`, `name`, `type`, `host` (`target`, or `target:port` for `tcp`), `status`, `tags`,
  `lastPing` (last response time in ms), `lastCheckedAt`. Unlike every other route here, this one
  **does** include the host/target — it exists for a trusted internal dashboard integration, not
  the public status page. It's intentionally unauthenticated and not linked from any UI, so treat
  the URL itself as the only thing gating access; don't link to it from anything public-facing.

### Admin (bearer token required)

- **`GET /api/monitors`** — full list of `Monitor` objects (all fields, including `target`/`port`),
  used to populate the admin edit form.

- **`POST /api/monitors`** — body: the monitor fields table above. Returns the created `Monitor`
  (`201`), or `400 { "error": "..." }` on a validation failure (missing `name`/`target`, bad
  `type`, or a `tcp` monitor without a valid `port`).

- **`PUT /api/monitors/:id`** — same body/validation as `POST`, replaces the monitor's fields.
  Returns the updated `Monitor`, or `404 { "error": "Not found" }`.

- **`DELETE /api/monitors/:id`** — deletes the monitor and its check history. Returns `204` with
  no body.

- **`POST /api/monitors/:id/ignore`** — body `{ "ignored"?: boolean }`. Omitting the field or
  passing anything other than `false` sets `ignored = true`; this is how the admin UI's "ignore
  while down" toggle works (acknowledges an outage without needing it to resolve first). Cleared
  automatically the next time the monitor has a successful check. Returns the updated `Monitor`,
  or `404`.

- **`POST /api/monitors/:id/seed-history`** — body `{ "uptimePct": number, "days"?: number }`
  (`days` defaults to 90, clamped to 1-90). Backfills synthetic check history at hourly resolution
  toward the target uptime %, replacing any existing history older than 1 hour (real recent checks
  are left alone). Returns `{ "ok": true }`, or `400` if `uptimePct` isn't a number in `[0, 100]`,
  or `404` if the monitor doesn't exist.

## Deployment model

Deploys are manual, via the `wrangler` CLI (`npm run deploy`), run from wherever you have the
repo checked out. There is no CI/CD wired up — pushing to GitHub does not trigger a deploy by
itself. This is a deliberate choice to keep things simple; see below if you want to change it.

**Headless / no-browser environments**: `wrangler login` needs a browser to complete OAuth. If
you're deploying from a headless box (CI runner, remote dev container, etc.) with no way to
complete that flow, authenticate with a scoped API token instead:

1. Cloudflare dashboard → **My Profile → API Tokens → Create Token → Edit Cloudflare Workers**
   template (don't hand-pick individual permissions — custom scopes tend to return a generic
   "Authentication error" from `wrangler` when something's missing, and are hard to debug blind).
   Add **Account → D1 → Edit** on top if you'll be running `wrangler d1` commands too.
2. `export CLOUDFLARE_API_TOKEN=<token>` in that shell, then `wrangler` commands work
   non-interactively.
3. If the account has **Client IP Address Filtering** enabled on tokens, add the deploying
   machine's outbound IP (or `0.0.0.0/0` for "any") to the token's allowed list, or you'll get a
   `Cannot use the access token from location: ... [code: 9109]` error.
4. Revoke the token once you're done deploying, or rotate it periodically — treat it like any
   other credential.

**Alternative: Cloudflare Git integration ("Workers Builds")** — if you'd rather have Cloudflare
auto-deploy on every push, connect this repo from the dashboard: **Workers & Pages → statuspage →
Settings → Builds → Connect**, then install the Cloudflare GitHub App against `Enfoid/statuspage`.
That setup step requires a browser (GitHub App OAuth install), so it has to be done from the
dashboard directly rather than from a headless shell. A few things it does *not* do for you:
- **D1 migrations still aren't automatic.** A new file under `migrations/` (like
  `0002_add_expected_body.sql`) still needs `wrangler d1 migrations apply statuspage-db --remote`
  run by hand after it lands, whether deploys are manual or Git-triggered.
- **Secrets are unaffected either way.** `ADMIN_TOKEN` is set via `wrangler secret put` regardless
  of what triggers the deploy; it isn't stored in the repo or build config.
- It doesn't change where the app runs — the Worker executes entirely on Cloudflare's network
  regardless of whether a laptop or GitHub triggered the deploy; Git integration only automates
  *how* new code gets pushed there.

## Notes

- Each monitor's `interval_minutes` controls how often it's actually checked; the cron trigger runs
  every minute but only executes monitors whose interval has elapsed since their last check.
- Raw check history is kept for 90 days and pruned automatically; uptime percentages and the daily
  history bar are computed from that data at render time.
