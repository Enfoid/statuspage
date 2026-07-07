import { BOOTSTRAP_CSS, BOOTSTRAP_ICONS_CSS, BOOTSTRAP_JS } from "./util";

export function renderAdminPage(): string {
  return `<!doctype html>
<html lang="en" data-bs-theme="auto">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Status Tracker &ndash; Admin</title>
  <link rel="stylesheet" href="${BOOTSTRAP_CSS}">
  <link rel="stylesheet" href="${BOOTSTRAP_ICONS_CSS}">
</head>
<body>
  <div class="container py-4" style="max-width: 1000px;">
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
            <div class="form-check">
              <input class="form-check-input" type="checkbox" id="fEnabled" checked>
              <label class="form-check-label" for="fEnabled">Enabled</label>
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
        tr.innerHTML = \`
          <td>\${escapeHtml(m.name)}</td>
          <td><span class="badge text-bg-secondary">\${m.type}</span></td>
          <td class="text-break">\${escapeHtml(targetLabel)}</td>
          <td>\${m.interval_minutes}m</td>
          <td>\${m.enabled ? '<span class="badge text-bg-success">Yes</span>' : '<span class="badge text-bg-secondary">No</span>'}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-secondary edit-btn" data-id="\${m.id}"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger delete-btn" data-id="\${m.id}"><i class="bi bi-trash"></i></button>
          </td>\`;
        tbody.appendChild(tr);
      }
      tbody.querySelectorAll('.edit-btn').forEach((b) => b.addEventListener('click', () => openEdit(Number(b.dataset.id))));
      tbody.querySelectorAll('.delete-btn').forEach((b) => b.addEventListener('click', () => deleteMonitor(Number(b.dataset.id))));
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
      document.getElementById('fEnabled').checked = !!m.enabled;
      updateTypeFields();
      new bootstrap.Modal(document.getElementById('monitorModal')).show();
    }

    async function deleteMonitor(id) {
      if (!confirm('Delete this monitor?')) return;
      await api('/api/monitors/' + id, { method: 'DELETE' });
      await loadMonitors();
    }

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
        enabled: document.getElementById('fEnabled').checked,
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
