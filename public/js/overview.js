// ── Overview section ──────────────────────────────────────────────────────────
loaders.overview = async function loadOverview() {
  const container = document.getElementById('section-overview');
  container.innerHTML = '<div class="text-base-content opacity-50 text-sm">Loading...</div>';

  const [skills, mcp, plugins, agents, commands] = await Promise.all([
    api('/api/skills'),
    api('/api/mcp'),
    api('/api/plugins'),
    api('/api/agents'),
    api('/api/commands'),
  ]);

  container.innerHTML = `
    <h2 class="text-lg font-bold mb-4 text-primary">Overview</h2>
    <div class="grid grid-cols-5 gap-4 mb-6">
      <div class="stat bg-base-100 rounded-box shadow-sm cursor-pointer hover:bg-base-200"
           onclick="showSection('skills')">
        <div class="stat-title">Skills</div>
        <div class="stat-value text-primary">${skills.length}</div>
        <div class="stat-desc">click to explore</div>
      </div>
      <div class="stat bg-base-100 rounded-box shadow-sm cursor-pointer hover:bg-base-200"
           onclick="showSection('mcp')">
        <div class="stat-title">MCP Servers</div>
        <div class="stat-value text-info">${mcp.length}</div>
        <div class="stat-desc">click to explore</div>
      </div>
      <div class="stat bg-base-100 rounded-box shadow-sm cursor-pointer hover:bg-base-200"
           onclick="showSection('plugins')">
        <div class="stat-title">Plugins</div>
        <div class="stat-value text-secondary">${plugins.length}</div>
        <div class="stat-desc">click to explore</div>
      </div>
      <div class="stat bg-base-100 rounded-box shadow-sm cursor-pointer hover:bg-base-200"
           onclick="showSection('agents')">
        <div class="stat-title">Agents</div>
        <div class="stat-value text-accent">${agents.length}</div>
        <div class="stat-desc">click to explore</div>
      </div>
      <div class="stat bg-base-100 rounded-box shadow-sm cursor-pointer hover:bg-base-200"
           onclick="showSection('commands')">
        <div class="stat-title">Commands</div>
        <div class="stat-value text-warning">${commands.length}</div>
        <div class="stat-desc">click to explore</div>
      </div>
    </div>
  `;
};
