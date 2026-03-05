# Skills Discovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a toggle view to the Skills page with a Discover tab that searches skills.sh and installs via one-click.

**Architecture:** Backend adds a proxy endpoint `GET /api/skills/search?q=` that forwards to `https://skills.sh/api/search` (avoids CORS). Frontend wraps the existing skills section in an Installed/Discover toggle, adds a search input and result cards with Install buttons.

**Tech Stack:** Node.js built-in `fetch` (Node 18+), Express, vanilla JS, DaisyUI

---

## Context

**Project location:** `/Users/peter.hueer/.claude/dashboard/`

**Files to modify:**
- `server.js` — add proxy endpoint + extend allowlist
- `public/app.js` — add toggle + discover view

**skills.sh API:**
- Search: `GET https://skills.sh/api/search?q=<query>&limit=20`
- Response: `{ skills: [{ id, skillId, name, installs, source }] }`
- Skill URL: `https://skills.sh/<id>` (e.g. `https://skills.sh/anthropics/skills/frontend-design`)
- Install: `npx skills add <source>@<skillId>` (e.g. `npx skills add anthropics/skills@frontend-design`)

**Current allowlist in server.js (line ~193):**
```javascript
const ALLOWED_COMMANDS = [
  /^claude plugin (install|remove) [a-zA-Z0-9@._/-]+$/,
];
```

**Current skills loader in app.js (line ~43):**
```javascript
loaders.skills = async function loadSkills() { ... }
```
This is the function to refactor into the Installed tab content.

---

## Task 1: Backend — proxy endpoint + allowlist

**Files:**
- Modify: `/Users/peter.hueer/.claude/dashboard/server.js`

**Step 1: Add the search proxy endpoint**

Insert this block in `server.js` immediately after the `GET /api/skills` route (around line 153):

```javascript
// GET /api/skills/search — proxy to skills.sh API
app.get('/api/skills/search', async (req, res) => {
  const q = req.query.q;
  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.status(400).json({ error: 'Missing query parameter q' });
  }
  try {
    const url = `https://skills.sh/api/search?q=${encodeURIComponent(q.trim())}&limit=20`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach skills.sh', detail: err.message });
  }
});
```

**Step 2: Extend the exec allowlist**

Find the `ALLOWED_COMMANDS` array and add the npx skills pattern:

```javascript
const ALLOWED_COMMANDS = [
  /^claude plugin (install|remove) [a-zA-Z0-9@._/-]+$/,
  /^npx skills add [a-zA-Z0-9@/_-]+$/,
];
```

**Step 3: Verify the proxy works**

Start the server and test:

```bash
pkill -f "node server.js"; true
node server.js &
sleep 2 && curl -s "http://127.0.0.1:3000/api/skills/search?q=debugging" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'count={d[\"count\"]}'); [print(s['name'], s['installs']) for s in d['skills'][:3]]"
```

Expected output:
```
count=6
systematic-debugging 22701
debugging 6755
debugging-strategies 3326
```

**Step 4: Test allowlist**

```bash
curl -s -X POST http://127.0.0.1:3000/api/exec \
  -H "Content-Type: application/json" \
  -d '{"cmd":"npx skills add anthropics/skills@frontend-design"}'
```

Expected: `{"success":true,...}` or a real install attempt (not a 403).

```bash
curl -s -X POST http://127.0.0.1:3000/api/exec \
  -H "Content-Type: application/json" \
  -d '{"cmd":"npx skills add ../../etc/passwd"}'
```

Expected: `{"error":"Command not permitted"}`

Kill server: `pkill -f "node server.js"`

**Step 5: Commit**

```bash
cd /Users/peter.hueer/.claude/dashboard
git add server.js
git commit -m "feat: add skills.sh search proxy and npx skills allowlist"
```

---

## Task 2: Frontend — toggle bar + view state

**Files:**
- Modify: `/Users/peter.hueer/.claude/dashboard/public/app.js`

**Step 1: Refactor `loaders.skills` to wrap installed view in a container**

Replace the current `loaders.skills` function with this version that renders the toggle bar + installed view:

```javascript
// Track current skills view: 'installed' | 'discover'
let skillsView = 'installed';

loaders.skills = async function loadSkills() {
  const container = document.getElementById('section-skills');
  container.innerHTML = renderSkillsToggle() + '<div id="skills-content"></div>';
  if (skillsView === 'installed') {
    await renderInstalledSkills();
  } else {
    renderDiscoverSkills();
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

function switchSkillsView(view) {
  skillsView = view;
  loaders.skills();
}
```

**Step 2: Extract installed view into its own function**

Take the body of the old `loaders.skills` and put it in `renderInstalledSkills`:

```javascript
async function renderInstalledSkills() {
  const content = document.getElementById('skills-content');
  content.innerHTML = '<div class="text-base-content opacity-50 text-sm">Loading skills...</div>';
  const skills = await api('/api/skills');

  const grouped = skills.reduce((acc, s) => {
    const key = s.plugin || 'other';
    acc[key] = acc[key] || [];
    acc[key].push(s);
    return acc;
  }, {});

  content.innerHTML = Object.entries(grouped).map(([plugin, items]) => `
    <div class="mb-6">
      <h2 class="text-lg font-bold mb-3 text-primary">${plugin}</h2>
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
```

**Step 3: Verify toggle renders**

Start server, open `http://127.0.0.1:3000`, navigate to Skills — should see two buttons: **Installed** (active) and **Discover**. Installed view should look identical to before.

**Step 4: Commit**

```bash
cd /Users/peter.hueer/.claude/dashboard
git add public/app.js
git commit -m "feat: add installed/discover toggle to skills page"
```

---

## Task 3: Frontend — Discover view with search

**Files:**
- Modify: `/Users/peter.hueer/.claude/dashboard/public/app.js`

**Step 1: Add `renderDiscoverSkills` function**

```javascript
function renderDiscoverSkills() {
  const content = document.getElementById('skills-content');
  content.innerHTML = `
    <div class="flex gap-2 mb-5">
      <input id="skills-search-input" type="text" placeholder="Search skills..."
        class="input input-bordered input-sm flex-1"
        onkeydown="if(event.key==='Enter') searchSkills()"
      />
      <button class="btn btn-sm btn-primary" onclick="searchSkills()">Search</button>
    </div>
    <div id="skills-search-results">
      <p class="text-sm opacity-50">Search for skills above to discover new ones.</p>
    </div>
  `;
  // Auto-focus search input
  setTimeout(() => document.getElementById('skills-search-input')?.focus(), 50);
}
```

**Step 2: Add `searchSkills` function**

```javascript
async function searchSkills() {
  const q = document.getElementById('skills-search-input')?.value?.trim();
  if (!q) return;

  const results = document.getElementById('skills-search-results');
  results.innerHTML = '<span class="loading loading-spinner loading-sm"></span>';

  const data = await api(`/api/skills/search?q=${encodeURIComponent(q)}`);

  if (data.error) {
    results.innerHTML = `<p class="text-sm text-error">${escHtml(data.error)}</p>`;
    return;
  }

  if (!data.skills?.length) {
    results.innerHTML = `<p class="text-sm opacity-50">No skills found for "${escHtml(q)}".</p>`;
    return;
  }

  results.innerHTML = `
    <p class="text-xs opacity-50 mb-3">${data.count} result${data.count !== 1 ? 's' : ''} for "${escHtml(q)}"</p>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      ${data.skills.map(s => {
        const installCmd = `npx skills add ${s.source}@${s.skillId}`;
        const skillUrl = `https://skills.sh/${s.id}`;
        const installs = s.installs >= 1000
          ? `${(s.installs / 1000).toFixed(1)}K`
          : s.installs;
        return `
          <div class="card bg-base-100 shadow-sm">
            <div class="card-body p-4">
              <h3 class="card-title text-sm">${escHtml(s.name)}</h3>
              <p class="text-xs opacity-50">${escHtml(s.source)}</p>
              <p class="text-xs text-success mt-1">${installs} installs</p>
              <div class="card-actions justify-end mt-2">
                <a href="${escHtml(skillUrl)}" target="_blank"
                  class="btn btn-xs btn-ghost">↗ View</a>
                <button id="install-${escAttr(s.skillId)}"
                  class="btn btn-xs btn-primary"
                  onclick="installSkill('${escAttr(installCmd)}', '${escAttr(s.skillId)}')">
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
```

**Step 3: Add `installSkill` function**

```javascript
async function installSkill(cmd, skillId) {
  const btn = document.getElementById(`install-${skillId}`);
  if (btn) {
    btn.textContent = 'Installing...';
    btn.disabled = true;
    btn.classList.add('btn-disabled');
  }
  await exec(cmd);
  if (btn) {
    btn.textContent = 'Installed';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-success');
  }
}
```

**Step 4: Test discover view**

Start server, navigate to Skills → click **Discover** → type "debugging" → press Enter or click Search.

Expected:
- Spinner appears briefly
- Cards appear: "systematic-debugging", "debugging", etc.
- Each card shows install count, source repo, View link, Install button
- Clicking Install changes button to "Installing..." then "Installed", terminal shows npx output

**Step 5: Commit**

```bash
cd /Users/peter.hueer/.claude/dashboard
git add public/app.js
git commit -m "feat: add skills discover view with search and one-click install"
```

---

## Done

Restart the server to test end-to-end:

```bash
pkill -f "node server.js"; true
node server.js
```

Open `http://127.0.0.1:3000` → Skills → toggle between Installed and Discover.
