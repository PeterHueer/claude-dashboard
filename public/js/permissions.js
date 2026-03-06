// ── Permissions section ───────────────────────────────────────────────────────
let _permsData = [];

loaders.permissions = async function loadPermissions() {
  const container = document.getElementById('section-permissions');
  container.innerHTML = '<div class="text-base-content opacity-50 text-sm">Loading permissions...</div>';
  try {
    _permsData = await api('/api/permissions');
  } catch (e) {
    container.innerHTML = `<p class="text-sm text-error">Failed to load permissions: ${escHtml(e.message)}</p>`;
    return;
  }
  if (!_permsData.length) {
    container.innerHTML = '<p class="text-sm opacity-50">No permissions configured.</p>';
    return;
  }
  initSearchBar(container, 'permissions-search', 'Search permissions…', renderPermissionsList);
  renderPermissionsList();
};

function renderPermissionsList() {
  const q = document.getElementById('permissions-search')?.value || '';
  const perms = filterByQuery(_permsData, q, ['rule', 'type', 'source']);
  const results = document.getElementById('permissions-search-results');
  if (!results) return;

  const allow = perms.filter(p => p.type === 'allow');
  const deny  = perms.filter(p => p.type === 'deny');

  results.innerHTML = !perms.length
    ? '<p class="text-sm opacity-50">No permissions match your search.</p>'
    : `<div class="grid grid-cols-2 gap-6">
        ${renderPermissionGroup('Allowed', allow, 'success')}
        ${renderPermissionGroup('Denied', deny, 'error')}
      </div>`;
}

function parseRule(rule) {
  // mcp__server__method
  const mcpMatch = rule.match(/^mcp__([^_]+(?:_[^_]+)*)__(.+)$/);
  if (mcpMatch) return { tool: 'MCP', detail: `${mcpMatch[1]} › ${mcpMatch[2]}`, raw: rule };

  // Tool(pattern)
  const toolMatch = rule.match(/^([A-Za-z]+)\((.+)\)$/);
  if (toolMatch) return { tool: toolMatch[1], detail: toolMatch[2], raw: rule };

  return { tool: 'Other', detail: rule, raw: rule };
}

function toolBadgeColor(tool) {
  const map = { Bash: 'badge-warning', WebFetch: 'badge-info', MCP: 'badge-accent',
                Read: 'badge-ghost', Edit: 'badge-ghost', Write: 'badge-ghost' };
  return map[tool] || 'badge-neutral';
}

function renderPermissionGroup(label, perms, color) {

  // Sub-group by tool category
  const grouped = perms.reduce((acc, p) => {
    const { tool } = parseRule(p.rule);
    acc[tool] = acc[tool] || [];
    acc[tool].push(p);
    return acc;
  }, {});

  const rows = Object.entries(grouped).map(([tool, items]) => `
    <div class="mb-5">
      <div class="flex items-center gap-2 mb-2">
        <span class="badge ${toolBadgeColor(tool)} badge-sm">${escHtml(tool)}</span>
        <span class="text-xs opacity-40">${items.length} rule${items.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="flex flex-col gap-2">
        ${items.map(p => renderPermissionRow(p)).join('')}
      </div>
    </div>
  `).join('');

  return `
    <div>
      <h2 class="text-lg font-bold mb-4 text-${color}">${escHtml(label)}</h2>
      ${perms.length ? rows : '<p class="text-sm opacity-40">None configured.</p>'}
    </div>
  `;
}

function renderPermissionRow(p) {
  const { tool, detail } = parseRule(p.rule);
  const sourceLabel = p.source === 'settings.local' ? 'local' : 'global';
  const sourceColor = p.source === 'settings.local' ? 'badge-primary' : 'badge-ghost';

  return `
    <div class="flex items-center gap-3 bg-base-100 rounded-lg px-4 py-3 shadow-sm">
      <span class="badge ${sourceColor} badge-sm flex-shrink-0">${escHtml(sourceLabel)}</span>
      <code class="text-xs flex-1 opacity-80 break-all">${escHtml(detail)}</code>
      <button class="btn btn-xs btn-error btn-outline flex-shrink-0"
        onclick="deletePermission(${JSON.stringify(p.rule)}, '${escAttr(p.source)}')">
        Remove
      </button>
    </div>
  `;
}

async function deletePermission(rule, source) {
  if (!confirm(`Remove permission:\n${rule}`)) return;
  const res = await fetch('/api/permissions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rule, source }),
  });
  const data = await res.json();
  if (data.success) {
    log(`Removed permission: ${rule}`);
    loaders.permissions();
  } else {
    log(`Error: ${data.error}`);
  }
}
