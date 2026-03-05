// ── Agents section ────────────────────────────────────────────────────────────
loaders.agents = async function loadAgents() {
  const container = document.getElementById('section-agents');
  container.innerHTML = '<div class="text-base-content opacity-50 text-sm">Loading agents...</div>';
  const agents = await api('/api/agents');

  if (agents.length === 0) {
    container.innerHTML = '<h2 class="text-lg font-bold mb-4 text-primary">Agents</h2><p class="text-sm opacity-50">No agents installed.</p>';
    return;
  }

  const grouped = agents.reduce((acc, a) => {
    const key = a.plugin || 'other';
    acc[key] = acc[key] || [];
    acc[key].push(a);
    return acc;
  }, {});

  container.innerHTML = `
    <h2 class="text-lg font-bold mb-5 text-primary">Agents</h2>
    ${Object.entries(grouped).map(([plugin, items]) => `
      <div class="mb-8">
        <div class="flex items-center gap-3 mb-4">
          <div class="flex items-center gap-2 bg-base-100 border border-base-content border-opacity-10 rounded-lg px-3 py-2 shadow-sm">
            <span class="text-base-content opacity-40 text-xs">plugin</span>
            <span class="font-bold text-secondary text-sm">${escHtml(plugin)}</span>
            <span class="badge badge-ghost badge-sm">${items.length}</span>
          </div>
          <div class="flex-1 border-t border-base-content border-opacity-10"></div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          ${items.map(agent => `
            <div class="card bg-base-100 shadow-sm border border-base-content border-opacity-5 hover:border-secondary hover:border-opacity-40 transition-colors">
              <div class="card-body p-4">
                <h4 class="font-semibold text-sm text-base-content">${escHtml(agent.name)}</h4>
                <p class="text-xs opacity-60 mt-1 leading-relaxed flex-1">${escHtml(agent.description || 'No description')}</p>
                <div class="card-actions justify-end mt-2">
                  <button class="btn btn-xs btn-outline btn-primary"
                    onclick="copyInvokeAgent('${escAttr(agent.name)}')">
                    Copy invoke
                  </button>
                  ${agent.file ? `
                  <button class="btn btn-xs btn-error btn-outline"
                    onclick="removeAgent('${escAttr(agent.file)}')">
                    Remove
                  </button>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('')}
  `;
};

function copyInvokeAgent(agentName) {
  navigator.clipboard.writeText(`Use agent: ${agentName}`)
    .then(() => log(`Copied: Use agent: ${agentName}`));
}

async function removeAgent(filePath) {
  if (!confirm('Move this agent to trash? You can restore it from the Trash section.')) return;
  const res = await fetch('/api/agents', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: filePath }),
  });
  const data = await res.json();
  if (data.success) {
    log(`Moved to trash: ${filePath}`);
    loaders.agents();
  } else {
    log(`Error: ${data.error}`);
  }
}
