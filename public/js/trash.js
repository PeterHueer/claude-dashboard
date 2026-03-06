// ── Trash section ─────────────────────────────────────────────────────────────
function trashItemName(item) {
  // originalPath e.g. ~/.claude/skills/systematic-debugging/SKILL.md
  // parent dir name = skill/agent name
  const parts = (item.originalPath || '').replace(/\\/g, '/').split('/');
  const filename = parts.at(-1) || '';
  const parentDir = parts.at(-2) || '';
  // If the file is SKILL.md or a named .md, use the parent dir
  if (filename.toUpperCase() === 'SKILL.MD' || parentDir) return parentDir || filename;
  return filename.replace(/\.md$/i, '') || item.id?.replace(/^[0-9]+-/, '') || 'unknown';
}

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
            <p class="text-sm font-medium truncate">${escHtml(trashItemName(item))}</p>
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
