// ── Plugins section ───────────────────────────────────────────────────────────
let _pluginsData = [];

loaders.plugins = async function loadPlugins() {
  const container = document.getElementById('section-plugins');
  container.innerHTML = '<div class="text-base-content opacity-50 text-sm">Loading plugins...</div>';
  _pluginsData = await api('/api/plugins');
  initSearchBar(container, 'plugins-search', 'Search plugins…', renderPluginsList);
  renderPluginsList();
};

function renderPluginsList() {
  const q = document.getElementById('plugins-search')?.value || '';
  const plugins = filterByQuery(_pluginsData, q, ['name', 'description', 'author', 'marketplace']);
  const results = document.getElementById('plugins-search-results');
  if (!results) return;

  results.innerHTML = !plugins.length
    ? '<p class="text-sm opacity-50">No plugins match your search.</p>'
    : `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        ${plugins.map(p => `
          <div class="card bg-base-100 shadow-sm">
            <div class="card-body p-4">
              <div class="flex items-center justify-between">
                <h3 class="card-title text-sm">${escHtml(p.name)}</h3>
                <span class="badge ${p.type === 'mcp' ? 'badge-info' : 'badge-primary'} badge-sm">${escHtml(p.type)}</span>
              </div>
              ${p.version ? `<p class="text-xs opacity-50">v${escHtml(p.version)}</p>` : ''}
              <p class="text-xs opacity-70 flex-1 mt-1">${escHtml(p.description || 'No description')}</p>
              ${p.author ? `<p class="text-xs opacity-40 mt-1">by ${escHtml(p.author)}</p>` : ''}
              <div class="card-actions justify-end mt-2">
                <button class="btn btn-xs btn-error btn-outline"
                  onclick="removePlugin('${escAttr(p.name)}')">
                  Remove
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>`;
}

async function removePlugin(name) {
  await exec(`claude plugin remove ${name}`);
  loaders.plugins();
}
