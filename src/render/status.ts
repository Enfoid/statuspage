import type { MonitorStatus } from "../db";
import { BOOTSTRAP_CSS, escapeHtml } from "./util";

type OverallStatus = "operational" | "degraded" | "outage" | "unknown";

function overallStatus(statuses: MonitorStatus[]): OverallStatus {
  const withData = statuses.filter((s) => s.latest !== null);
  if (withData.length === 0) return "unknown";
  const down = withData.filter((s) => !s.latest!.success).length;
  if (down === 0) return "operational";
  if (down === withData.length) return "outage";
  return "degraded";
}

const BANNER: Record<OverallStatus, { cls: string; icon: string; text: string }> = {
  operational: { cls: "success", icon: "bi-check-circle-fill", text: "All Systems Operational" },
  degraded: { cls: "warning", icon: "bi-exclamation-triangle-fill", text: "Partial System Outage" },
  outage: { cls: "danger", icon: "bi-x-octagon-fill", text: "Major System Outage" },
  unknown: { cls: "secondary", icon: "bi-question-circle-fill", text: "Status Unknown" },
};

function statusBadge(s: MonitorStatus): string {
  if (!s.latest) return `<span class="badge rounded-pill text-bg-secondary">No data</span>`;
  return s.latest.success
    ? `<span class="badge rounded-pill text-bg-success">Up</span>`
    : `<span class="badge rounded-pill text-bg-danger">Down</span>`;
}

function historyBar(s: MonitorStatus): string {
  const cells = s.history
    .map((day) => {
      let cls = "bg-secondary-subtle";
      let title = `${day.date}: no data`;
      if (day.total > 0) {
        cls = day.uptime_pct === 100 ? "bg-success" : "bg-danger";
        title = `${day.date}: ${day.uptime_pct}% uptime`;
      }
      return `<div class="history-cell ${cls}" title="${escapeHtml(title)}"></div>`;
    })
    .join("");
  return `<div class="history-bar">${cells}</div>`;
}

function targetLabel(s: MonitorStatus): string {
  const m = s.monitor;
  return m.type === "http" ? m.target : `${m.target}:${m.port}`;
}

function uptimeLine(s: MonitorStatus): string {
  const fmt = (v: number | null) => (v === null ? "&ndash;" : `${v}%`);
  return `
    <div class="d-flex gap-3 small text-secondary flex-wrap">
      <span>24h: <strong class="text-body">${fmt(s.uptime24h)}</strong></span>
      <span>7d: <strong class="text-body">${fmt(s.uptime7d)}</strong></span>
      <span>30d: <strong class="text-body">${fmt(s.uptime30d)}</strong></span>
      <span>90d: <strong class="text-body">${fmt(s.uptime90d)}</strong></span>
      ${s.avgResponseMs !== null ? `<span>Avg response: <strong class="text-body">${s.avgResponseMs}ms</strong></span>` : ""}
    </div>`;
}

function monitorCard(s: MonitorStatus): string {
  return `
    <div class="card mb-3 monitor-card">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <div class="d-flex align-items-center gap-2">
              <h5 class="mb-0">${escapeHtml(s.monitor.name)}</h5>
              ${statusBadge(s)}
            </div>
            <div class="text-secondary small">${escapeHtml(targetLabel(s))}</div>
          </div>
          ${uptimeLine(s)}
        </div>
        ${historyBar(s)}
        <div class="d-flex justify-content-between small text-secondary mt-1">
          <span>${s.history.length} days ago</span>
          <span>Today</span>
        </div>
        ${
          s.latest && !s.latest.success && s.latest.error
            ? `<div class="small text-danger mt-1">${escapeHtml(s.latest.error)}</div>`
            : ""
        }
      </div>
    </div>`;
}

export function renderStatusPage(statuses: MonitorStatus[], title = "Status"): string {
  const overall = overallStatus(statuses);
  const banner = BANNER[overall];
  const now = new Date().toUTCString();

  return `<!doctype html>
<html lang="en" data-bs-theme="auto">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${BOOTSTRAP_CSS}">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
  <style>
    body { background-color: var(--bs-tertiary-bg); }
    .status-banner { border-radius: .75rem; }
    .history-bar { display: flex; gap: 2px; margin-top: .5rem; height: 34px; }
    .history-cell { flex: 1 1 0; border-radius: 2px; min-width: 2px; }
    .monitor-card { border: none; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .page-wrap { max-width: 860px; }
  </style>
</head>
<body>
  <div class="container page-wrap py-4 py-md-5">
    <div class="text-center mb-4">
      <h1 class="h3 mb-1">${escapeHtml(title)}</h1>
      <div class="text-secondary small">Last updated ${escapeHtml(now)}</div>
    </div>

    <div class="alert alert-${banner.cls} status-banner d-flex align-items-center gap-2 justify-content-center py-3 mb-4" role="status">
      <i class="bi ${banner.icon} fs-4"></i>
      <span class="fs-5 fw-semibold">${banner.text}</span>
    </div>

    ${
      statuses.length === 0
        ? `<div class="text-center text-secondary py-5">No monitors configured yet.</div>`
        : statuses.map(monitorCard).join("\n")
    }

    <div class="text-center text-secondary small mt-4">
      Refreshes automatically &middot; <a href="/" class="link-secondary">reload</a>
    </div>
  </div>
</body>
</html>`;
}
