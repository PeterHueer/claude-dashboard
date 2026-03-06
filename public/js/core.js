// ── Utilities ─────────────────────────────────────────────────────────────────
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ── Security helpers ──────────────────────────────────────────────────────────
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

// ── Section loaders registry ──────────────────────────────────────────────────
const loaders = {};

// ── Navigation ────────────────────────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('[id^="section-"]').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('[id^="nav-"]').forEach(el => el.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.remove('hidden');
  document.getElementById(`nav-${name}`).classList.add('active');
  if (loaders[name]) loaders[name]();
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function api(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
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

// ── Search helpers ────────────────────────────────────────────────────────────
function initSearchBar(container, inputId, placeholder, renderFn) {
  container.innerHTML = `
    <input type="text" id="${inputId}" placeholder="${escHtml(placeholder)}"
      class="input input-bordered input-sm mb-5" style="min-width:260px" />
    <div id="${inputId}-results"></div>
  `;
  const input = document.getElementById(inputId);
  input.addEventListener('input', renderFn);
  input.focus();
}

function filterByQuery(items, query, fields) {
  const q = query.toLowerCase().trim();
  if (!q) return items;
  return items.filter(item =>
    fields.some(f => String(item[f] || '').toLowerCase().includes(q))
  );
}

// ── Terminal ──────────────────────────────────────────────────────────────────
function log(text) {
  const el = document.getElementById('terminal-output');
  el.textContent += text + '\n';
  el.scrollTop = el.scrollHeight;
}

function clearTerminal() {
  document.getElementById('terminal-output').textContent = '';
}
