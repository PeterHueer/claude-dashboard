// ── MCP Servers section ───────────────────────────────────────────────────────
let _mcpData = [];

loaders.mcp = async function loadMcp() {
  const container = document.getElementById('section-mcp');
  container.innerHTML = '<div class="text-base-content opacity-50 text-sm">Loading MCP servers...</div>';
  _mcpData = await api('/api/mcp');
  if (!_mcpData.length) {
    container.innerHTML = '<p class="text-sm opacity-50">No active MCP servers found.</p>';
    return;
  }
  initSearchBar(container, 'mcp-search', 'Search MCP servers…', renderMcpList);
  renderMcpList();
};

function renderMcpList() {
  const q = document.getElementById('mcp-search')?.value || '';
  const servers = filterByQuery(_mcpData, q, ['name', 'source', 'url', 'command']);
  const results = document.getElementById('mcp-search-results');
  if (!results) return;

  results.innerHTML = !servers.length
    ? '<p class="text-sm opacity-50">No servers match your search.</p>'
    : `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        ${servers.map(s => {
          const isPlugin = s.source !== 'global';
          const pluginName = isPlugin ? s.source.replace('plugin:', '') : null;
          const cmd = [s.command, ...(s.args || [])].filter(Boolean).join(' ');
          const endpoint = s.url || cmd;
          return `
            <div class="card bg-base-100 shadow-sm">
              <div class="card-body p-4">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="card-title text-sm">${escHtml(s.name)}</h3>
                  <span class="badge ${isPlugin ? 'badge-info' : 'badge-ghost'} badge-sm flex-shrink-0">
                    ${isPlugin ? escHtml(pluginName) : 'global'}
                  </span>
                </div>
                <p class="text-xs opacity-70 font-mono mt-1 break-all">${escHtml(endpoint)}</p>
                <div class="card-actions justify-end mt-2">
                  ${isPlugin
                    ? `<div class="tooltip" data-tip="Managed by plugin ${escAttr(pluginName)} — uninstall the plugin to remove">
                         <button class="btn btn-xs btn-error btn-outline btn-disabled" disabled>Remove</button>
                       </div>`
                    : `<button class="btn btn-xs btn-error btn-outline" onclick="removeMcp('${escAttr(s.name)}')">Remove</button>`}
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
}

async function removeMcp(name) {
  if (!confirm(`Remove MCP server "${name}" from global config?`)) return;
  const res = await fetch('/api/mcp', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (data.success) {
    log(`Removed MCP server: ${name}`);
    loaders.mcp();
  } else {
    log(`Error: ${data.error}`);
  }
}
