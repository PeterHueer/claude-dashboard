// ── MCP Servers section ───────────────────────────────────────────────────────
let mcpView = 'installed';

loaders.mcp = async function loadMcp() {
  const container = document.getElementById('section-mcp');
  container.innerHTML = renderMcpToggle() + '<div id="mcp-content"></div>';
  if (mcpView === 'installed') {
    await renderInstalledMcp();
  } else {
    renderDiscoverMcp();
  }
};

function renderMcpToggle() {
  return `
    <div class="flex gap-2 mb-5">
      <button onclick="switchMcpView('installed')"
        class="btn btn-sm ${mcpView === 'installed' ? 'btn-primary' : 'btn-ghost'}">
        Installed
      </button>
      <button onclick="switchMcpView('discover')"
        class="btn btn-sm ${mcpView === 'discover' ? 'btn-primary' : 'btn-ghost'}">
        Discover
      </button>
    </div>
  `;
}

async function switchMcpView(view) {
  mcpView = view;
  await loaders.mcp();
}

async function renderInstalledMcp() {
  const content = document.getElementById('mcp-content');
  content.innerHTML = '<div class="text-base-content opacity-50 text-sm">Loading MCP servers...</div>';
  const servers = await api('/api/mcp');

  content.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      ${servers.map(s => {
        const isPlugin = s.source !== 'global';
        const pluginName = isPlugin ? s.source.replace('plugin:', '') : null;
        return `
        <div class="card bg-base-100 shadow-sm">
          <div class="card-body p-4">
            <div class="flex items-center justify-between gap-2">
              <h3 class="card-title text-sm">${escHtml(s.name)}</h3>
              <div class="flex gap-1 flex-shrink-0">
                <span class="badge badge-success badge-sm">active</span>
                ${isPlugin
                  ? `<span class="badge badge-info badge-sm" title="Provided by plugin: ${escAttr(pluginName)}">plugin</span>`
                  : '<span class="badge badge-ghost badge-sm">global</span>'}
              </div>
            </div>
            <p class="text-xs opacity-70 font-mono mt-1">${escHtml(s.command || s.url || '')} ${escHtml((s.args || []).join(' '))}</p>
            ${isPlugin
              ? `<p class="text-xs opacity-50 mt-1">via ${escHtml(pluginName)}</p>`
              : '<p class="text-xs opacity-50 mt-1">~/.mcp.json</p>'}
            <div class="card-actions justify-end mt-2">
              ${isPlugin
                ? `<div class="tooltip" data-tip="Managed by plugin — remove the plugin to disable this server">
                     <button class="btn btn-xs btn-error btn-outline btn-disabled" disabled>Remove</button>
                   </div>`
                : `<button class="btn btn-xs btn-error btn-outline" onclick="removeMcp('${escAttr(s.name)}')">Remove</button>`}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderDiscoverMcp() {
  const content = document.getElementById('mcp-content');
  content.innerHTML = `
    <div class="max-w-lg">
      <div class="card bg-base-100 shadow-sm border border-info border-opacity-20">
        <div class="card-body p-6">
          <h3 class="card-title text-base text-info mb-1">Discover MCP Servers</h3>
          <p class="text-sm opacity-70 mb-4">
            Browse the MCP Server marketplace to find servers for databases, APIs, tools, and more.
            Install via your <span class="font-mono text-xs bg-base-200 px-1 rounded">~/.mcp.json</span> config.
          </p>
          <div class="card-actions">
            <a href="https://mcpmarket.com/" target="_blank" rel="noopener noreferrer"
              class="btn btn-info btn-sm">Browse mcpmarket.com ↗</a>
          </div>
        </div>
      </div>
      <p class="text-xs opacity-30 mt-3">mcpmarket.com does not provide a public search API — browse and configure servers manually.</p>
    </div>
  `;
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
