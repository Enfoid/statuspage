import type { PublicMonitorStatus } from "../db";
import { BOOTSTRAP_CSS, BOOTSTRAP_ICONS_CSS, escapeHtml } from "./util";

type OverallStatus = "operational" | "degraded" | "outage" | "unknown";

function overallStatus(statuses: PublicMonitorStatus[]): OverallStatus {
  const withData = statuses.filter((s) => s.status === "up" || s.status === "down");
  if (withData.length === 0) return "unknown";
  const down = withData.filter((s) => s.status === "down").length;
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

function statusBadge(s: PublicMonitorStatus): string {
  if (s.status === "paused") return `<span class="badge rounded-pill text-bg-secondary">N/A</span>`;
  if (s.status === "pending") return `<span class="badge rounded-pill text-bg-secondary">No data</span>`;
  return s.status === "up"
    ? `<span class="badge rounded-pill text-bg-success">Up</span>`
    : `<span class="badge rounded-pill text-bg-danger">Down</span>`;
}

function historyBar(s: PublicMonitorStatus): string {
  const dayCells = s.history
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

  const nowCls =
    s.status === "up" ? "bg-success" : s.status === "down" ? "bg-danger" : "bg-secondary-subtle";
  const nowTitle =
    s.status === "up"
      ? "Now: up"
      : s.status === "down"
        ? `Now: down${s.error ? ` (${s.error})` : ""}`
        : s.status === "paused"
          ? "Now: paused"
          : "Now: no data";

  return `<div class="history-bar">
    <div class="history-days">${dayCells}</div>
    <div class="history-cell history-now ${nowCls}" title="${escapeHtml(nowTitle)}"></div>
  </div>`;
}

/** Tags render as plain links to `/?tag=<tag>` so they're shareable/bookmarkable — clicking the
 * currently active tag links back to `/` to clear the filter. No client-side JS involved. */
function tagBadges(tags: string[], activeTag: string | null): string {
  if (tags.length === 0) return "";
  return tags
    .map((t) => {
      const lower = t.toLowerCase();
      const isActive = activeTag !== null && lower === activeTag;
      const href = isActive ? "/" : `/?tag=${encodeURIComponent(lower)}`;
      const cls = isActive ? "text-bg-primary" : "text-bg-secondary";
      return `<a href="${href}" class="badge rounded-pill ${cls} text-decoration-none">${escapeHtml(t)}</a>`;
    })
    .join(" ");
}

function uptimeLine(s: PublicMonitorStatus, activeTag: string | null): string {
  const fmt = (v: number | null) => (v === null ? "&ndash;" : `${v}%`);
  return `
    <div class="d-flex gap-2 small text-secondary flex-wrap align-items-center">
      ${tagBadges(s.tags, activeTag)}
      <span>24h: <strong class="text-body">${fmt(s.uptime24h)}</strong></span>
      <span>7d: <strong class="text-body">${fmt(s.uptime7d)}</strong></span>
      <span>30d: <strong class="text-body">${fmt(s.uptime30d)}</strong></span>
      <span>90d: <strong class="text-body">${fmt(s.uptime90d)}</strong></span>
      ${s.avgResponseMs !== null ? `<span>Avg response: <strong class="text-body">${s.avgResponseMs}ms</strong></span>` : ""}
    </div>`;
}

function monitorCard(s: PublicMonitorStatus, activeTag: string | null): string {
  return `
    <div class="card mb-3 monitor-card">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div class="d-flex align-items-center gap-2">
            <h5 class="mb-0">${escapeHtml(s.name)}</h5>
            ${statusBadge(s)}
          </div>
          ${uptimeLine(s, activeTag)}
        </div>
        ${historyBar(s)}
        <div class="d-flex justify-content-between small text-secondary mt-1">
          <span>${s.history.length} days ago</span>
          <span>Today</span>
        </div>
        ${
          s.status === "down" && s.error
            ? `<div class="small text-danger mt-1">${escapeHtml(s.error)}</div>`
            : ""
        }
      </div>
    </div>`;
}

export interface StatusPageOptions {
  title?: string;
  activeTag?: string | null;
  hasAnyMonitors?: boolean;
  /** Extra stylesheet URL, injected when the request is served on the defunct.stream domain. */
  extraCss?: string | null;
}

export function renderStatusPage(statuses: PublicMonitorStatus[], opts: StatusPageOptions = {}): string {
  const { title = "EnFoid Uptimes", activeTag = null, hasAnyMonitors = statuses.length > 0 } = opts;
  const overall = overallStatus(statuses);
  const banner = BANNER[overall];
  const now = new Date().toUTCString();

  let emptyMessage = "";
  if (statuses.length === 0) {
    emptyMessage = activeTag
      ? `<div class="text-center text-secondary py-5">No monitors tagged "${escapeHtml(activeTag)}". <a href="/" class="link-secondary">Clear filter</a></div>`
      : hasAnyMonitors
        ? `<div class="text-center text-secondary py-5">No monitors match this filter.</div>`
        : `<div class="text-center text-secondary py-5">No monitors configured yet.</div>`;
  }

  const troubled = statuses.filter((s) => s.status === "down" && !s.ignored);
  const rest = statuses.filter((s) => !(s.status === "down" && !s.ignored));
  const troubleSection =
    troubled.length > 0
      ? `<div class="border border-danger rounded-3 p-3 mb-4">
           <h2 class="h6 text-danger-emphasis mb-3 d-flex align-items-center gap-2">
             <i class="bi bi-exclamation-triangle-fill"></i> Currently Down
           </h2>
           ${troubled.map((s) => monitorCard(s, activeTag)).join("\n")}
         </div>`
      : "";

  return `<!doctype html>
<html lang="en" data-bs-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="icon" href="/favicon.ico">
  <link rel="stylesheet" href="${BOOTSTRAP_CSS}">
  <link rel="stylesheet" href="${BOOTSTRAP_ICONS_CSS}">
  ${opts.extraCss ? `<link rel="stylesheet" href="${opts.extraCss}">` : ""}
  <style>
    body { background-color: var(--bs-tertiary-bg); }
    .status-banner { border-radius: .75rem; }
    .history-bar { display: flex; gap: 3px; margin-top: .5rem; height: 34px; }
    .history-days { display: flex; gap: 2px; flex: 1 1 auto; min-width: 0; }
    .history-cell { flex: 1 1 0; border-radius: 2px; min-width: 2px; }
    .history-now { flex: 0 0 12px; }
    .monitor-card { border: 1px solid var(--bs-border-color); }
  </style>
</head>
<body>
  <div class="container-fluid py-4 py-md-5">
    <div class="row">
      <div class="col-12 col-lg-8 offset-lg-2">
        <div class="text-center mb-4">
          <h1 class="h3 mb-1">${escapeHtml(title)}</h1>
          <div class="text-secondary small">Last updated ${escapeHtml(now)}</div>
        </div>

        <div class="alert alert-${banner.cls} status-banner d-flex align-items-center gap-2 justify-content-center py-3 mb-4" role="status">
          <i class="bi ${banner.icon} fs-4"></i>
          <span class="fs-5 fw-semibold">${banner.text}</span>
        </div>

        ${
          activeTag
            ? `<div class="text-center small text-secondary mb-3">Filtered by tag <span class="badge rounded-pill text-bg-primary">${escapeHtml(activeTag)}</span> &middot; <a href="/" class="link-secondary">clear</a></div>`
            : ""
        }

        ${statuses.length === 0 ? emptyMessage : troubleSection + rest.map((s) => monitorCard(s, activeTag)).join("\n")}

        <div class="text-center text-secondary small mt-4">
          Refreshes automatically &middot; <a href="${activeTag ? `/?tag=${encodeURIComponent(activeTag)}` : "/"}" class="link-secondary">reload</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
