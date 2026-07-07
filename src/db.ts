export type MonitorType = "http" | "tcp";

export interface Monitor {
  id: number;
  name: string;
  type: MonitorType;
  target: string;
  port: number | null;
  interval_minutes: number;
  timeout_ms: number;
  expected_status_min: number;
  expected_status_max: number;
  enabled: number; // 0 | 1
  sort_order: number;
  created_at: string;
}

export interface MonitorInput {
  name: string;
  type: MonitorType;
  target: string;
  port?: number | null;
  interval_minutes?: number;
  timeout_ms?: number;
  expected_status_min?: number;
  expected_status_max?: number;
  enabled?: boolean;
  sort_order?: number;
}

export interface CheckResult {
  success: boolean;
  response_time_ms: number | null;
  status_code: number | null;
  error: string | null;
}

export interface DailyHistoryEntry {
  date: string;
  total: number;
  up: number;
  uptime_pct: number | null; // null = no checks that day
}

export interface MonitorStatus {
  monitor: Monitor;
  latest: {
    success: boolean;
    checked_at: string;
    response_time_ms: number | null;
    status_code: number | null;
    error: string | null;
  } | null;
  uptime24h: number | null;
  uptime7d: number | null;
  uptime30d: number | null;
  uptime90d: number | null;
  avgResponseMs: number | null;
  history: DailyHistoryEntry[];
}

const HISTORY_DAYS = 90;

export async function listMonitors(db: D1Database): Promise<Monitor[]> {
  const { results } = await db
    .prepare("SELECT * FROM monitors ORDER BY sort_order ASC, id ASC")
    .all<Monitor>();
  return results ?? [];
}

export async function getMonitor(db: D1Database, id: number): Promise<Monitor | null> {
  return db.prepare("SELECT * FROM monitors WHERE id = ?").bind(id).first<Monitor>();
}

export async function createMonitor(db: D1Database, input: MonitorInput): Promise<Monitor> {
  const result = await db
    .prepare(
      `INSERT INTO monitors
        (name, type, target, port, interval_minutes, timeout_ms, expected_status_min, expected_status_max, enabled, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(
      input.name,
      input.type,
      input.target,
      input.port ?? null,
      input.interval_minutes ?? 5,
      input.timeout_ms ?? 10000,
      input.expected_status_min ?? 200,
      input.expected_status_max ?? 399,
      input.enabled === false ? 0 : 1,
      input.sort_order ?? 0
    )
    .first<Monitor>();
  if (!result) throw new Error("Failed to create monitor");
  return result;
}

export async function updateMonitor(
  db: D1Database,
  id: number,
  input: MonitorInput
): Promise<Monitor | null> {
  return db
    .prepare(
      `UPDATE monitors SET
        name = ?, type = ?, target = ?, port = ?, interval_minutes = ?, timeout_ms = ?,
        expected_status_min = ?, expected_status_max = ?, enabled = ?, sort_order = ?
       WHERE id = ?
       RETURNING *`
    )
    .bind(
      input.name,
      input.type,
      input.target,
      input.port ?? null,
      input.interval_minutes ?? 5,
      input.timeout_ms ?? 10000,
      input.expected_status_min ?? 200,
      input.expected_status_max ?? 399,
      input.enabled === false ? 0 : 1,
      input.sort_order ?? 0,
      id
    )
    .first<Monitor>();
}

export async function deleteMonitor(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM monitors WHERE id = ?").bind(id).run();
}

export async function insertCheck(
  db: D1Database,
  monitorId: number,
  result: CheckResult
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO checks (monitor_id, success, response_time_ms, status_code, error)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(
      monitorId,
      result.success ? 1 : 0,
      result.response_time_ms,
      result.status_code,
      result.error
    )
    .run();
}

/** Monitors that are enabled and whose check interval has elapsed since their last check. */
export async function getDueMonitors(db: D1Database): Promise<Monitor[]> {
  const { results } = await db
    .prepare(
      `SELECT m.* FROM monitors m
       LEFT JOIN (
         SELECT monitor_id, MAX(checked_at) AS last_checked
         FROM checks GROUP BY monitor_id
       ) c ON c.monitor_id = m.id
       WHERE m.enabled = 1
         AND (c.last_checked IS NULL OR c.last_checked <= datetime('now', '-' || m.interval_minutes || ' minutes'))`
    )
    .all<Monitor>();
  return results ?? [];
}

export async function pruneOldChecks(db: D1Database, retentionDays = HISTORY_DAYS): Promise<void> {
  await db
    .prepare(`DELETE FROM checks WHERE checked_at < datetime('now', '-' || ? || ' days')`)
    .bind(retentionDays)
    .run();
}

async function getUptimePct(db: D1Database, monitorId: number, hours: number): Promise<number | null> {
  const row = await db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(success) AS up
       FROM checks
       WHERE monitor_id = ? AND checked_at >= datetime('now', '-' || ? || ' hours')`
    )
    .bind(monitorId, hours)
    .first<{ total: number; up: number | null }>();
  if (!row || row.total === 0) return null;
  return Math.round(((row.up ?? 0) / row.total) * 10000) / 100;
}

async function getDailyHistory(
  db: D1Database,
  monitorId: number,
  days = HISTORY_DAYS
): Promise<DailyHistoryEntry[]> {
  const { results } = await db
    .prepare(
      `SELECT
         date(checked_at) AS date,
         COUNT(*) AS total,
         SUM(success) AS up
       FROM checks
       WHERE monitor_id = ? AND checked_at >= datetime('now', '-' || ? || ' days')
       GROUP BY date(checked_at)`
    )
    .bind(monitorId, days)
    .all<{ date: string; total: number; up: number }>();

  const byDate = new Map((results ?? []).map((r) => [r.date, r]));
  const history: DailyHistoryEntry[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const row = byDate.get(dateStr);
    history.push({
      date: dateStr,
      total: row?.total ?? 0,
      up: row?.up ?? 0,
      uptime_pct: row && row.total > 0 ? Math.round((row.up / row.total) * 10000) / 100 : null,
    });
  }
  return history;
}

export async function getMonitorStatus(db: D1Database, monitor: Monitor): Promise<MonitorStatus> {
  const [latest, uptime24h, uptime7d, uptime30d, uptime90d, history, avgRow] = await Promise.all([
    db
      .prepare(
        `SELECT success, checked_at, response_time_ms, status_code, error
         FROM checks WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT 1`
      )
      .bind(monitor.id)
      .first<{
        success: number;
        checked_at: string;
        response_time_ms: number | null;
        status_code: number | null;
        error: string | null;
      }>(),
    getUptimePct(db, monitor.id, 24),
    getUptimePct(db, monitor.id, 24 * 7),
    getUptimePct(db, monitor.id, 24 * 30),
    getUptimePct(db, monitor.id, 24 * 90),
    getDailyHistory(db, monitor.id, HISTORY_DAYS),
    db
      .prepare(
        `SELECT AVG(response_time_ms) AS avg_ms FROM checks
         WHERE monitor_id = ? AND checked_at >= datetime('now', '-24 hours') AND response_time_ms IS NOT NULL`
      )
      .bind(monitor.id)
      .first<{ avg_ms: number | null }>(),
  ]);

  return {
    monitor,
    latest: latest
      ? {
          success: !!latest.success,
          checked_at: latest.checked_at,
          response_time_ms: latest.response_time_ms,
          status_code: latest.status_code,
          error: latest.error,
        }
      : null,
    uptime24h,
    uptime7d,
    uptime30d,
    uptime90d,
    avgResponseMs: avgRow?.avg_ms != null ? Math.round(avgRow.avg_ms) : null,
    history,
  };
}

export async function getAllMonitorStatuses(db: D1Database): Promise<MonitorStatus[]> {
  const monitors = await listMonitors(db);
  return Promise.all(monitors.map((m) => getMonitorStatus(db, m)));
}
