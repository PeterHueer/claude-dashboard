// ── Commands section ───────────────────────────────────────────────────────────
loaders.commands = async function loadCommands() {
  const container = document.getElementById('section-commands');
  container.innerHTML = '<div class="text-base-content opacity-50 text-sm">Loading commands...</div>';

  const commands = await api('/api/commands');

  if (commands.length === 0) {
    container.innerHTML = `
      <h2 class="text-lg font-bold mb-4 text-primary">Custom Commands</h2>
      <p class="text-sm opacity-50">No custom commands found in ~/.claude/commands/</p>
    `;
    return;
  }

  // Group by prefix (e.g. "micro", "macro") or "global" for top-level commands
  const grouped = commands.reduce((acc, cmd) => {
    const colonIdx = cmd.name.indexOf(':');
    const group = colonIdx !== -1 ? cmd.name.slice(0, colonIdx) : 'global';
    acc[group] = acc[group] || [];
    acc[group].push(cmd);
    return acc;
  }, {});

  // Sort groups: global first, rest alphabetically
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
    if (a === 'global') return -1;
    if (b === 'global') return 1;
    return a.localeCompare(b);
  });

  container.innerHTML = `
    <h2 class="text-lg font-bold mb-4 text-primary">Custom Commands</h2>
    ${sortedGroups.map(([group, items]) => `
      <div class="mb-6">
        <h3 class="text-base font-semibold mb-3 opacity-70">
          ${group === 'global' ? 'Global' : escHtml(group)}
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          ${items.map(cmd => `
            <div class="card bg-base-100 shadow-sm">
              <div class="card-body p-4">
                <h4 class="card-title text-sm font-mono">/${escHtml(cmd.name)}</h4>
                <p class="text-xs opacity-70 flex-1">${escHtml(cmd.description || 'No description')}</p>
                <div class="card-actions justify-end mt-2">
                  <button class="btn btn-xs btn-outline btn-primary"
                    onclick="copyCommand('${escAttr(cmd.name)}')">
                    Copy invoke
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('')}
  `;
};

function copyCommand(name) {
  navigator.clipboard.writeText(`/${name}`)
    .then(() => log(`Copied: /${name}`));
}
