// ── Utilities ────────────────────────────────────────────────────────────────
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ── Navigation ──────────────────────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('[id^="section-"]').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('[id^="nav-"]').forEach(el => el.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.remove('hidden');
  document.getElementById(`nav-${name}`).classList.add('active');
  if (loaders[name]) loaders[name]();
}

// ── API helpers ──────────────────────────────────────────────────────────────
async function api(path) {
  const res = await fetch(path);
  return res.json();
}

async function exec(cmd) {
  log(`$ ${cmd}`);
  const res = await fetch('/api/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd }),
  });
  const data = await res.json();
  log(data.output || data.error || 'done');
  return data;
}

// ── Terminal ─────────────────────────────────────────────────────────────────
function log(text) {
  const el = document.getElementById('terminal-output');
  el.textContent += text + '\n';
  el.scrollTop = el.scrollHeight;
}

function clearTerminal() {
  document.getElementById('terminal-output').textContent = '';
}

// ── Section loaders registry ─────────────────────────────────────────────────
const loaders = {};

// ── Skills section ───────────────────────────────────────────────────────────
// Track current skills view: 'installed' | 'discover'
let skillsView = 'installed';

loaders.skills = async function loadSkills() {
  const container = document.getElementById('section-skills');
  container.innerHTML = renderSkillsToggle() + '<div id="skills-content"></div>';
  if (skillsView === 'installed') {
    await renderInstalledSkills();
  } else {
    await renderDiscoverSkills();
  }
};

function renderSkillsToggle() {
  return `
    <div class="flex gap-2 mb-5">
      <button id="tab-installed" onclick="switchSkillsView('installed')"
        class="btn btn-sm ${skillsView === 'installed' ? 'btn-primary' : 'btn-ghost'}">
        Installed
      </button>
      <button id="tab-discover" onclick="switchSkillsView('discover')"
        class="btn btn-sm ${skillsView === 'discover' ? 'btn-primary' : 'btn-ghost'}">
        Discover
      </button>
    </div>
  `;
}

async function switchSkillsView(view) {
  skillsView = view;
  await loaders.skills();
}

async function renderInstalledSkills() {
  const content = document.getElementById('skills-content');
  content.innerHTML = '<div class="text-base-content opacity-50 text-sm">Loading skills...</div>';
  const skills = await api('/api/skills');
  if (skills.length === 0) {
    content.innerHTML = '<p class="text-sm opacity-50">No skills installed.</p>';
    return;
  }

  const grouped = skills.reduce((acc, s) => {
    const key = s.plugin || 'other';
    acc[key] = acc[key] || [];
    acc[key].push(s);
    return acc;
  }, {});

  content.innerHTML = Object.entries(grouped).map(([plugin, items]) => `
    <div class="mb-6">
      <h2 class="text-lg font-bold mb-3 text-primary">${escHtml(plugin)}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        ${items.map(skill => `
          <div class="card bg-base-100 shadow-sm">
            <div class="card-body p-4">
              <h3 class="card-title text-sm">${escHtml(skill.name)}</h3>
              <p class="text-xs opacity-70 flex-1">${escHtml(skill.description || 'No description')}</p>
              <div class="card-actions justify-end mt-2">
                <button class="btn btn-xs btn-outline btn-primary"
                  onclick="copyInvoke('${escAttr(skill.name)}')">
                  Copy invoke
                </button>
                <button class="btn btn-xs btn-error btn-outline"
                  onclick="removeSkill('${escAttr(skill.file)}')">
                  Remove
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

const debouncedSearchSkills = debounce(searchSkills, 400);

async function renderDiscoverSkills() {
  const content = document.getElementById('skills-content');
  content.innerHTML = `
    <div class="flex gap-2 mb-3 w-fit">
      <input id="skills-search-input" type="text" placeholder="Search skills..."
        class="input input-bordered input-sm"
        style="min-width:220px"
        oninput="debouncedSearchSkills()"
        onkeydown="if(event.key==='Enter') searchSkills()"
      />
      <button class="btn btn-sm btn-primary" onclick="searchSkills()">Search</button>
    </div>
    <div class="flex items-center gap-3 mb-5">
      <a href="https://skills.sh/" target="_blank" rel="noopener noreferrer"
        class="btn btn-xs btn-ghost">All Time ↗</a>
      <a href="https://skills.sh/trending" target="_blank" rel="noopener noreferrer"
        class="btn btn-xs btn-ghost">Trending ↗</a>
      <a href="https://skills.sh/hot" target="_blank" rel="noopener noreferrer"
        class="btn btn-xs btn-ghost">Hot ↗</a>
      <span class="text-xs opacity-30">powered by skills.sh</span>
    </div>
    <div id="skills-search-results">
      <p class="text-sm opacity-50">Search for skills above to discover new ones.</p>
    </div>
  `;
  setTimeout(() => document.getElementById('skills-search-input')?.focus(), 50);
}

async function searchSkills() {
  const q = document.getElementById('skills-search-input')?.value?.trim();
  if (!q) return;

  const results = document.getElementById('skills-search-results');
  results.innerHTML = '<span class="loading loading-spinner loading-sm"></span>';

  let data;
  try {
    data = await api(`/api/skills/search?q=${encodeURIComponent(q)}`);
  } catch (err) {
    results.innerHTML = `<p class="text-sm text-error">Network error: ${escHtml(err.message)}</p>`;
    return;
  }

  if (data.error) {
    results.innerHTML = `<p class="text-sm text-error">${escHtml(data.error)}</p>`;
    return;
  }

  if (!data.skills?.length) {
    results.innerHTML = `<p class="text-sm opacity-50">No skills found for "${escHtml(q)}".</p>`;
    return;
  }

  results.innerHTML = `
    <p class="text-xs opacity-50 mb-3">${escHtml(String(Number(data.count) || 0))} result${data.count !== 1 ? 's' : ''} for "${escHtml(q)}"</p>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      ${data.skills.map(s => {
        const installCmd = `npx skills add ${s.source}@${s.skillId}`;
        const skillUrl = `https://skills.sh/${s.id}`;
        const installs = s.installs >= 1000
          ? `${(s.installs / 1000).toFixed(1)}K`
          : String(s.installs);
        return `
          <div class="card bg-base-100 shadow-sm">
            <div class="card-body p-4">
              <h3 class="card-title text-sm">${escHtml(s.name)}</h3>
              <p class="text-xs opacity-50">${escHtml(s.source)}</p>
              <p class="text-xs text-success mt-1">${escHtml(installs)} installs</p>
              <div class="card-actions justify-end mt-2">
                ${skillUrl.startsWith('https://') ? `<a href="${escHtml(skillUrl)}" target="_blank" rel="noopener noreferrer"
                  class="btn btn-xs btn-ghost">↗ View</a>` : ''}
                <button
                  data-install-cmd="${escHtml(installCmd)}"
                  data-skill-id="${escHtml(s.skillId)}"
                  class="btn btn-xs btn-primary"
                  onclick="installSkill(this)">
                  Install
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function installSkill(btn) {
  const cmd = btn.dataset.installCmd;
  if (btn) {
    btn.textContent = 'Installing...';
    btn.disabled = true;
    btn.classList.add('btn-disabled');
    btn.classList.remove('btn-primary');
  }
  let result;
  try {
    result = await exec(cmd);
  } catch (err) {
    if (btn) {
      btn.textContent = 'Failed';
      btn.classList.add('btn-error');
      btn.disabled = false;
      btn.classList.remove('btn-disabled');
    }
    return;
  }
  if (btn) {
    if (result && result.success === false) {
      btn.textContent = 'Failed';
      btn.classList.add('btn-error');
      btn.disabled = false;
      btn.classList.remove('btn-disabled');
    } else {
      btn.textContent = 'Installed';
      btn.classList.add('btn-success');
    }
  }
}

async function removeSkill(filePath) {
  if (!confirm('Remove this skill file? It may return if the plugin is reinstalled.')) return;
  const res = await fetch('/api/skills', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: filePath }),
  });
  const data = await res.json();
  if (data.success) {
    log(`Removed skill: ${filePath}`);
    loaders.skills();
  } else {
    log(`Error: ${data.error}`);
  }
}

function copyInvoke(skillName) {
  navigator.clipboard.writeText(`Use skill: ${skillName}`)
    .then(() => log(`Copied: Use skill: ${skillName}`));
}

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
                ${isPlugin ? `<span class="badge badge-info badge-sm" title="Provided by plugin: ${escAttr(pluginName)}">plugin</span>` : '<span class="badge badge-ghost badge-sm">global</span>'}
              </div>
            </div>
            <p class="text-xs opacity-70 font-mono mt-1">${escHtml(s.command || s.url || '')} ${escHtml((s.args || []).join(' '))}</p>
            ${isPlugin ? `<p class="text-xs opacity-50 mt-1">via ${escHtml(pluginName)}</p>` : '<p class="text-xs opacity-50 mt-1">~/.mcp.json</p>'}
            <div class="card-actions justify-end mt-2">
              ${isPlugin
                ? `<div class="tooltip" data-tip="Managed by plugin — remove the plugin to disable this server">
                     <button class="btn btn-xs btn-error btn-outline btn-disabled" disabled>Remove</button>
                   </div>`
                : `<button class="btn btn-xs btn-error btn-outline" onclick="removeMcp('${escAttr(s.name)}')">Remove</button>`
              }
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

// ── Plugins section ───────────────────────────────────────────────────────────
loaders.plugins = async function loadPlugins() {
  const container = document.getElementById('section-plugins');
  container.innerHTML = '<div class="text-base-content opacity-50 text-sm">Loading plugins...</div>';
  const plugins = await api('/api/plugins');

  container.innerHTML = `
    <h2 class="text-lg font-bold mb-4 text-primary">Plugins</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
    </div>
  `;
};

async function removePlugin(name) {
  await exec(`claude plugin remove ${name}`);
  loaders.plugins();
}

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

// ── Trash section ─────────────────────────────────────────────────────────────
loaders.trash = async function loadTrash() {
  const container = document.getElementById('section-trash');
  container.innerHTML = '<div class="text-base-content opacity-50 text-sm">Loading trash...</div>';
  const items = await api('/api/trash');

  if (items.length === 0) {
    container.innerHTML = `
      <h2 class="text-lg font-bold mb-4 text-error">Trash</h2>
      <p class="text-sm opacity-50">Trash is empty.</p>
    `;
    return;
  }

  container.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-lg font-bold text-error">Trash</h2>
      <span class="text-xs opacity-50">${items.length} item${items.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="flex flex-col gap-3">
      ${items.map(item => `
        <div class="flex items-center gap-4 bg-base-100 rounded-box px-4 py-3 shadow-sm border border-base-content border-opacity-5">
          <span class="badge ${item.type === 'agent' ? 'badge-secondary' : 'badge-primary'} badge-sm flex-shrink-0">${escHtml(item.type || 'file')}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">${escHtml(item.id?.replace(/^[0-9]+-/, '') || 'unknown')}</p>
            <p class="text-xs opacity-40 truncate">${escHtml(item.originalPath || '')}</p>
          </div>
          <span class="text-xs opacity-30 flex-shrink-0">${escHtml(item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : '')}</span>
          <div class="flex gap-2 flex-shrink-0">
            <button class="btn btn-xs btn-success btn-outline"
              data-trash-id="${escAttr(item.id)}"
              onclick="restoreTrashItem(this)">Restore</button>
            <button class="btn btn-xs btn-error btn-outline"
              data-trash-id="${escAttr(item.id)}"
              onclick="deleteTrashItem(this)">Delete forever</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
};

async function restoreTrashItem(btn) {
  const id = btn.dataset.trashId;
  btn.textContent = 'Restoring...';
  btn.disabled = true;
  const res = await fetch('/api/trash/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  const data = await res.json();
  if (data.success) {
    log(`Restored: ${id}`);
    loaders.trash();
  } else {
    log(`Error: ${data.error}`);
    btn.textContent = 'Restore';
    btn.disabled = false;
  }
}

async function deleteTrashItem(btn) {
  const id = btn.dataset.trashId;
  if (!confirm('Permanently delete this item? This cannot be undone.')) return;
  const res = await fetch('/api/trash', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  const data = await res.json();
  if (data.success) {
    log(`Permanently deleted: ${id}`);
    loaders.trash();
  } else {
    log(`Error: ${data.error}`);
  }
}

// ── Overview section ──────────────────────────────────────────────────────────
loaders.overview = async function loadOverview() {
  const container = document.getElementById('section-overview');
  container.innerHTML = '<div class="text-base-content opacity-50 text-sm">Loading...</div>';

  const [skills, mcp, plugins, agents] = await Promise.all([
    api('/api/skills'),
    api('/api/mcp'),
    api('/api/plugins'),
    api('/api/agents'),
  ]);

  container.innerHTML = `
    <h2 class="text-lg font-bold mb-4 text-primary">Overview</h2>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
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
    </div>
  `;
};

// ── Security helpers (prevent XSS in templates) ───────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
showSection('overview');
