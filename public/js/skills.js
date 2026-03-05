// ── Skills section ────────────────────────────────────────────────────────────
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
      <button class="btn btn-xs btn-ghost" onclick="browseSkills('alltime', 'All Time')">All Time</button>
      <button class="btn btn-xs btn-ghost" onclick="browseSkills('trending', 'Trending')">Trending</button>
      <button class="btn btn-xs btn-ghost" onclick="browseSkills('hot', 'Hot')">Hot</button>
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
    ${renderSkillCards(data.skills)}
  `;
}

async function browseSkills(type, label) {
  const results = document.getElementById('skills-search-results');
  results.innerHTML = '<span class="loading loading-spinner loading-sm"></span>';

  let data;
  try {
    data = await api(`/api/browse/${type}`);
  } catch (err) {
    results.innerHTML = `<p class="text-sm text-error">Network error: ${escHtml(err.message)}</p>`;
    return;
  }
  if (data.error) {
    results.innerHTML = `<p class="text-sm text-error">${escHtml(data.error)}</p>`;
    return;
  }

  const skills = Array.isArray(data) ? data : [];
  results.innerHTML = `
    <p class="text-xs opacity-50 mb-3">${escHtml(label)} — ${skills.length} skills</p>
    ${renderSkillCards(skills)}
  `;
}

function renderSkillCards(skills) {
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      ${skills.map(s => {
        const installCmd = `npx skills add ${s.source}@${s.skillId} --yes --global`;
        const skillUrl = `https://skills.sh/${s.id || s.source + '/' + s.skillId}`;
        const installs = s.installs >= 1000 ? `${(s.installs / 1000).toFixed(1)}K` : String(s.installs);
        return `
          <div class="card bg-base-100 shadow-sm">
            <div class="card-body p-4">
              <h3 class="card-title text-sm">${escHtml(s.name)}</h3>
              <p class="text-xs opacity-50">${escHtml(s.source)}</p>
              <p class="text-xs text-success mt-1">${escHtml(installs)} installs</p>
              <div class="card-actions justify-end mt-2">
                <a href="${escHtml(skillUrl)}" target="_blank" rel="noopener noreferrer"
                  class="btn btn-xs btn-ghost">↗ View</a>
                <button class="btn btn-xs btn-primary"
                  data-install-cmd="${escAttr(installCmd)}"
                  data-skill-id="${escAttr(s.skillId)}"
                  onclick="installSkill(this)">Install</button>
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
  btn.textContent = 'Installing...';
  btn.disabled = true;
  btn.classList.add('btn-disabled');
  btn.classList.remove('btn-primary');
  let result;
  try {
    result = await exec(cmd);
  } catch {
    btn.textContent = 'Failed';
    btn.classList.add('btn-error');
    btn.disabled = false;
    btn.classList.remove('btn-disabled');
    return;
  }
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
