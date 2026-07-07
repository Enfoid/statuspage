import { BOOTSTRAP_CSS, BOOTSTRAP_ICONS_CSS, BOOTSTRAP_JS } from "./util";

export function renderAdminPage(): string {
  return `<!doctype html>
<html lang="en" data-bs-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EnFoid Uptimes &ndash; Admin</title>
  <link rel="icon" href="https://www.enfoid.com/favicon.ico">
  <link rel="stylesheet" href="${BOOTSTRAP_CSS}">
  <link rel="stylesheet" href="${BOOTSTRAP_ICONS_CSS}">
</head>
<body>
  <div class="container-fluid py-4">
   <div class="row justify-content-center">
    <div class="col-12 col-xl-10">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="h4 mb-0">Monitor Admin</h1>
      <div class="d-flex gap-2">
        <a href="/" class="btn btn-outline-secondary btn-sm">View status page</a>
        <button id="logoutBtn" class="btn btn-outline-danger btn-sm d-none">Log out</button>
      </div>
    </div>

    <div id="loginView" class="card mx-auto" style="max-width: 420px;">
      <div class="card-body">
        <h2 class="h6">Admin token</h2>
        <p class="text-secondary small">Enter the admin bearer token to manage monitors.</p>
        <div class="input-group">
          <input type="password" id="tokenInput" class="form-control" placeholder="Admin token">
          <button id="tokenSaveBtn" class="btn btn-primary">Unlock</button>
        </div>
        <div id="loginError" class="text-danger small mt-2 d-none">Invalid token.</div>
      </div>
    </div>

    <div id="adminView" class="d-none">
      <div class="d-flex justify-content-end mb-3">
        <button id="addBtn" class="btn btn-primary btn-sm"><i class="bi bi-plus-lg"></i> Add monitor</button>
      </div>
      <div class="table-responsive">
        <table class="table table-hover align-middle bg-body">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Target</th>
              <th>Tags</th>
              <th>Interval</th>
              <th>Enabled</th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody id="monitorRows"></tbody>
        </table>
      </div>
      <div id="emptyState" class="text-secondary text-center py-4 d-none">No monitors yet.</div>
    </div>
    </div>
   </div>
  </div>

  <div class="modal fade" id="monitorModal" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <form id="monitorForm">
          <div class="modal-header">
            <h5 class="modal-title" id="monitorModalTitle">Add monitor</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="monitorId">
            <div class="mb-3">
              <label class="form-label">Name</label>
              <input required class="form-control" id="fName" placeholder="My website">
            </div>
            <div class="mb-3">
              <label class="form-label">Type</label>
              <select class="form-select" id="fType">
                <option value="http">HTTP(S)</option>
                <option value="tcp">TCP port</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label" id="fTargetLabel">URL</label>
              <input required class="form-control" id="fTarget" placeholder="https://example.com">
            </div>
            <div class="mb-3 d-none" id="fPortWrap">
              <label class="form-label">Port</label>
              <input type="number" class="form-control" id="fPort" placeholder="443">
            </div>
            <div class="mb-3">
              <label class="form-label">Tags (comma-separated)</label>
              <input class="form-control" id="fTags" placeholder="prod, eu, project-x">
              <div class="form-text">Shown as clickable badges on the public page; clicking one filters to that tag.</div>
            </div>
            <div class="row">
              <div class="col mb-3">
                <label class="form-label">Interval (minutes)</label>
                <input type="number" min="1" class="form-control" id="fInterval" value="5">
              </div>
              <div class="col mb-3">
                <label class="form-label">Timeout (ms)</label>
                <input type="number" min="500" class="form-control" id="fTimeout" value="10000">
              </div>
            </div>
            <div class="row d-none" id="fStatusRangeWrap">
              <div class="col mb-3">
                <label class="form-label">Expected status min</label>
                <input type="number" class="form-control" id="fStatusMin" value="200">
              </div>
              <div class="col mb-3">
                <label class="form-label">Expected status max</label>
                <input type="number" class="form-control" id="fStatusMax" value="399">
              </div>
            </div>
            <div class="mb-3 d-none" id="fExpectedBodyWrap">
              <label class="form-label">Expected content (optional)</label>
              <input class="form-control" id="fExpectedBody" placeholder='e.g. "status":"ok"'>
              <div class="form-text">If set, the check also fails when this text isn't found in the response body &mdash; catches a 200 that's actually an error page.</div>
            </div>
            <div class="form-check">
              <input class="form-check-input" type="checkbox" id="fEnabled" checked>
              <label class="form-check-label" for="fEnabled">Enabled (uncheck to pause monitoring)</label>
            </div>
            <div class="form-check">
              <input class="form-check-input" type="checkbox" id="fEmailAlerts">
              <label class="form-check-label" for="fEmailAlerts">Email alerts on down/recovered</label>
              <div class="form-text">Sends one email when this monitor goes down and one when it recovers &mdash; not on every failed check, so a monitor that's regularly offline won't flood your inbox.</div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <div class="modal fade" id="seedModal" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <form id="seedForm">
          <div class="modal-header">
            <h5 class="modal-title">Seed history</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="seedMonitorId">
            <p class="text-secondary small">
              Backfills synthetic check history so this monitor doesn't look brand new.
              Real checks from the last hour are kept; anything older in the seeded range is replaced.
            </p>
            <div class="mb-3">
              <label class="form-label">Target uptime %</label>
              <input type="number" step="0.01" min="0" max="100" class="form-control" id="seedUptime" value="99.9">
            </div>
            <div class="mb-3">
              <label class="form-label">Days of history</label>
              <input type="number" min="1" max="90" class="form-control" id="seedDays" value="90">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Seed history</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <script src="${BOOTSTRAP_JS}"></script>
  <script>
    const TOKEN_KEY = 'statuspage_admin_token';
    let monitors = [];

    function token() { return localStorage.getItem(TOKEN_KEY) || ''; }
    function authHeaders() { return { 'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json' }; }

    async function api(path, opts = {}) {
      const res = await fetch(path, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } });
      if (res.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        showLogin(true);
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Request failed: ' + res.status);
      return res.status === 204 ? null : res.json();
    }

    function showLogin(withError) {
      document.getElementById('loginView').classList.remove('d-none');
      document.getElementById('adminView').classList.add('d-none');
      document.getElementById('logoutBtn').classList.add('d-none');
      document.getElementById('loginError').classList.toggle('d-none', !withError);
    }

    function showAdmin() {
      document.getElementById('loginView').classList.add('d-none');
      document.getElementById('adminView').classList.remove('d-none');
      document.getElementById('logoutBtn').classList.remove('d-none');
    }

    function renderRows() {
      const tbody = document.getElementById('monitorRows');
      tbody.innerHTML = '';
      document.getElementById('emptyState').classList.toggle('d-none', monitors.length > 0);
      for (const m of monitors) {
        const tr = document.createElement('tr');
        const targetLabel = m.type === 'tcp' ? (m.target + ':' + m.port) : m.target;
        const tags = (m.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
        const tagsHtml = tags.map((t) => '<span class="badge text-bg-secondary me-1">' + escapeHtml(t) + '</span>').join('');
        tr.innerHTML = \`
          <td>\${escapeHtml(m.name)} \${m.ignored ? '<span class="badge text-bg-warning">Ignored</span>' : ''}</td>
          <td><span class="badge text-bg-secondary">\${m.type}</span></td>
          <td class="text-break">\${escapeHtml(targetLabel)}</td>
          <td>\${tagsHtml}</td>
          <td>\${m.interval_minutes}m</td>
          <td>\${m.enabled ? '<span class="badge text-bg-success">Yes</span>' : '<span class="badge text-bg-secondary">No</span>'}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-secondary ignore-btn" data-id="\${m.id}" title="\${m.ignored ? 'Un-ignore' : 'Ignore while down'}"><i class="bi \${m.ignored ? 'bi-eye' : 'bi-eye-slash'}"></i></button>
            <button class="btn btn-sm btn-outline-secondary pause-btn" data-id="\${m.id}" title="\${m.enabled ? 'Pause monitoring' : 'Resume monitoring'}"><i class="bi \${m.enabled ? 'bi-pause-circle' : 'bi-play-circle'}"></i></button>
            <button class="btn btn-sm btn-outline-secondary seed-btn" data-id="\${m.id}" title="Seed history"><i class="bi bi-clock-history"></i></button>
            <button class="btn btn-sm btn-outline-secondary edit-btn" data-id="\${m.id}"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger delete-btn" data-id="\${m.id}"><i class="bi bi-trash"></i></button>
          </td>\`;
        tbody.appendChild(tr);
      }
      tbody.querySelectorAll('.edit-btn').forEach((b) => b.addEventListener('click', () => openEdit(Number(b.dataset.id))));
      tbody.querySelectorAll('.delete-btn').forEach((b) => b.addEventListener('click', () => deleteMonitor(Number(b.dataset.id))));
      tbody.querySelectorAll('.seed-btn').forEach((b) => b.addEventListener('click', () => openSeed(Number(b.dataset.id))));
      tbody.querySelectorAll('.pause-btn').forEach((b) => b.addEventListener('click', () => togglePause(Number(b.dataset.id))));
      tbody.querySelectorAll('.ignore-btn').forEach((b) => b.addEventListener('click', () => toggleIgnored(Number(b.dataset.id))));
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    async function loadMonitors() {
      monitors = await api('/api/monitors');
      renderRows();
    }

    function updateTypeFields() {
      const isTcp = document.getElementById('fType').value === 'tcp';
      document.getElementById('fPortWrap').classList.toggle('d-none', !isTcp);
      document.getElementById('fStatusRangeWrap').classList.toggle('d-none', isTcp);
      document.getElementById('fExpectedBodyWrap').classList.toggle('d-none', isTcp);
      document.getElementById('fTargetLabel').textContent = isTcp ? 'Hostname / IP' : 'URL';
      document.getElementById('fTarget').placeholder = isTcp ? 'db.internal.example.com' : 'https://example.com';
    }

    function openAdd() {
      document.getElementById('monitorModalTitle').textContent = 'Add monitor';
      document.getElementById('monitorForm').reset();
      document.getElementById('monitorId').value = '';
      document.getElementById('fType').value = 'http';
      updateTypeFields();
      new bootstrap.Modal(document.getElementById('monitorModal')).show();
    }

    function openEdit(id) {
      const m = monitors.find((x) => x.id === id);
      if (!m) return;
      document.getElementById('monitorModalTitle').textContent = 'Edit monitor';
      document.getElementById('monitorId').value = m.id;
      document.getElementById('fName').value = m.name;
      document.getElementById('fType').value = m.type;
      document.getElementById('fTarget').value = m.target;
      document.getElementById('fPort').value = m.port || '';
      document.getElementById('fInterval').value = m.interval_minutes;
      document.getElementById('fTimeout').value = m.timeout_ms;
      document.getElementById('fStatusMin').value = m.expected_status_min;
      document.getElementById('fStatusMax').value = m.expected_status_max;
      document.getElementById('fExpectedBody').value = m.expected_body || '';
      document.getElementById('fTags').value = m.tags || '';
      document.getElementById('fEnabled').checked = !!m.enabled;
      document.getElementById('fEmailAlerts').checked = !!m.email_alerts;
      updateTypeFields();
      new bootstrap.Modal(document.getElementById('monitorModal')).show();
    }

    async function deleteMonitor(id) {
      if (!confirm('Delete this monitor?')) return;
      await api('/api/monitors/' + id, { method: 'DELETE' });
      await loadMonitors();
    }

    async function togglePause(id) {
      const m = monitors.find((x) => x.id === id);
      if (!m) return;
      await api('/api/monitors/' + id, { method: 'PUT', body: JSON.stringify({ ...m, enabled: !m.enabled }) });
      await loadMonitors();
    }

    async function toggleIgnored(id) {
      const m = monitors.find((x) => x.id === id);
      if (!m) return;
      await api('/api/monitors/' + id + '/ignore', { method: 'POST', body: JSON.stringify({ ignored: !m.ignored }) });
      await loadMonitors();
    }

    function openSeed(id) {
      document.getElementById('seedMonitorId').value = id;
      new bootstrap.Modal(document.getElementById('seedModal')).show();
    }

    document.getElementById('seedForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('seedMonitorId').value;
      const body = {
        uptimePct: Number(document.getElementById('seedUptime').value),
        days: Number(document.getElementById('seedDays').value),
      };
      await api('/api/monitors/' + id + '/seed-history', { method: 'POST', body: JSON.stringify(body) });
      bootstrap.Modal.getInstance(document.getElementById('seedModal')).hide();
    });

    document.getElementById('fType').addEventListener('change', updateTypeFields);
    document.getElementById('addBtn').addEventListener('click', openAdd);

    document.getElementById('monitorForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('monitorId').value;
      const body = {
        name: document.getElementById('fName').value,
        type: document.getElementById('fType').value,
        target: document.getElementById('fTarget').value,
        port: document.getElementById('fPort').value ? Number(document.getElementById('fPort').value) : null,
        interval_minutes: Number(document.getElementById('fInterval').value),
        timeout_ms: Number(document.getElementById('fTimeout').value),
        expected_status_min: Number(document.getElementById('fStatusMin').value),
        expected_status_max: Number(document.getElementById('fStatusMax').value),
        expected_body: document.getElementById('fExpectedBody').value.trim() || null,
        tags: document.getElementById('fTags').value,
        enabled: document.getElementById('fEnabled').checked,
        email_alerts: document.getElementById('fEmailAlerts').checked,
      };
      if (id) {
        await api('/api/monitors/' + id, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/api/monitors', { method: 'POST', body: JSON.stringify(body) });
      }
      bootstrap.Modal.getInstance(document.getElementById('monitorModal')).hide();
      await loadMonitors();
    });

    document.getElementById('tokenSaveBtn').addEventListener('click', async () => {
      localStorage.setItem(TOKEN_KEY, document.getElementById('tokenInput').value.trim());
      try {
        await loadMonitors();
        showAdmin();
      } catch {
        showLogin(true);
      }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
      localStorage.removeItem(TOKEN_KEY);
      showLogin(false);
    });

    (async function init() {
      if (!token()) { showLogin(false); return; }
      try {
        await loadMonitors();
        showAdmin();
      } catch {
        showLogin(false);
      }
    })();
  </script>
</body>
</html>`;
}
