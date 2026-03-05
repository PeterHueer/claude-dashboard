const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

const app = express();
const PORT = 3000;
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const TRASH_DIR = path.join(CLAUDE_DIR, '.dashboard-trash');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper functions

function moveToTrash(filePath, meta) {
  if (!fs.existsSync(TRASH_DIR)) {
    fs.mkdirSync(TRASH_DIR, { recursive: true });
  }
  const id = `${Date.now()}-${path.basename(filePath)}`;
  const trashFile = path.join(TRASH_DIR, id);
  const trashMeta = path.join(TRASH_DIR, id.replace(/\.md$/, '.json'));
  fs.copyFileSync(filePath, trashFile);
  fs.writeFileSync(trashMeta, JSON.stringify({
    ...meta,
    originalPath: filePath,
    deletedAt: new Date().toISOString(),
    id,
  }));
  fs.unlinkSync(filePath);
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function runCommand(cmd, args, cwd) {
  try {
    const result = execSync([cmd, ...args].join(' '), {
      encoding: 'utf8',
      timeout: 10000,
      cwd: cwd || os.homedir(),
      env: { ...process.env },
    });
    return { success: true, output: result };
  } catch (err) {
    return { success: false, output: err.stderr || err.message };
  }
}

// GET /api/mcp

function discoverMcpServers() {
  const servers = {};

  const globalMcp = readJsonFile(path.join(os.homedir(), '.mcp.json'));
  if (globalMcp?.mcpServers) {
    Object.entries(globalMcp.mcpServers).forEach(([name, config]) => {
      servers[name] = { name, ...config, source: 'global' };
    });
  }

  const pluginsDir = path.join(CLAUDE_DIR, 'plugins', 'marketplaces');
  if (fs.existsSync(pluginsDir)) {
    const marketplaces = fs.readdirSync(pluginsDir);
    for (const marketplace of marketplaces) {
      const extPluginsDir = path.join(pluginsDir, marketplace, 'external_plugins');
      if (!fs.existsSync(extPluginsDir)) continue;
      const plugins = fs.readdirSync(extPluginsDir);
      for (const plugin of plugins) {
        const mcpPath = path.join(extPluginsDir, plugin, '.mcp.json');
        const mcp = readJsonFile(mcpPath);
        if (!mcp) continue;
        Object.entries(mcp).forEach(([name, config]) => {
          if (!servers[name]) {
            servers[name] = { name, ...config, source: `plugin:${plugin}` };
          }
        });
      }
    }
  }

  return Object.values(servers);
}

app.get('/api/mcp', (req, res) => {
  res.json(discoverMcpServers());
});

// GET /api/plugins

function discoverPlugins() {
  const plugins = [];
  const pluginsDir = path.join(CLAUDE_DIR, 'plugins', 'marketplaces');
  if (!fs.existsSync(pluginsDir)) return plugins;

  const marketplaces = fs.readdirSync(pluginsDir);
  for (const marketplace of marketplaces) {
    for (const category of ['plugins', 'external_plugins']) {
      const categoryDir = path.join(pluginsDir, marketplace, category);
      if (!fs.existsSync(categoryDir)) continue;
      const items = fs.readdirSync(categoryDir);
      for (const item of items) {
        const pluginJsonPath = path.join(categoryDir, item, '.claude-plugin', 'plugin.json');
        const meta = readJsonFile(pluginJsonPath);
        if (!meta) continue;
        plugins.push({
          name: meta.name || item,
          description: meta.description || '',
          version: meta.version || null,
          author: meta.author?.name || null,
          type: category === 'external_plugins' ? 'mcp' : 'skill',
          marketplace,
        });
      }
    }
  }
  return plugins;
}

app.get('/api/plugins', (req, res) => {
  res.json(discoverPlugins());
});

// GET /api/skills

function discoverSkills() {
  const skills = [];
  const pluginsDir = path.join(CLAUDE_DIR, 'plugins', 'marketplaces');
  if (!fs.existsSync(pluginsDir)) return skills;

  function scanSkillsDir(dir, pluginName) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanSkillsDir(fullPath, pluginName);
      } else if (entry.name.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const nameMatch = content.match(/^name:\s*(.+)$/m);
        const descMatch = content.match(/^description:\s*(.+)$/m);
        const skillName = nameMatch?.[1]?.trim() || path.basename(entry.name, '.md');
        const description = descMatch?.[1]?.trim() || '';
        skills.push({ name: skillName, description, plugin: pluginName, file: fullPath });
      }
    }
  }

  const marketplaces = fs.readdirSync(pluginsDir);
  for (const marketplace of marketplaces) {
    const pluginsSubDir = path.join(pluginsDir, marketplace, 'plugins');
    if (!fs.existsSync(pluginsSubDir)) continue;
    const pluginDirs = fs.readdirSync(pluginsSubDir);
    for (const plugin of pluginDirs) {
      const skillsDir = path.join(pluginsSubDir, plugin, 'skills');
      scanSkillsDir(skillsDir, plugin);
    }
  }

  return skills;
}

app.get('/api/skills', (req, res) => {
  res.json(discoverSkills());
});

// GET /api/agents

function discoverAgents() {
  const agents = [];
  const pluginsDir = path.join(CLAUDE_DIR, 'plugins', 'marketplaces');
  if (!fs.existsSync(pluginsDir)) return agents;

  function scanAgentsDir(dir, pluginName) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const fullPath = path.join(dir, entry.name);
      const content = fs.readFileSync(fullPath, 'utf8');
      const nameMatch = content.match(/^name:\s*(.+)$/m);
      // description may be multi-line (block scalar) — grab first non-empty line after "description:"
      const descMatch = content.match(/^description:\s*(.+)$/m)
        || content.match(/^description:\s*\|\s*\n\s*(.+)$/m);
      const agentName = nameMatch?.[1]?.trim() || path.basename(entry.name, '.md');
      const description = descMatch?.[1]?.trim().replace(/<[^>]+>/g, '').substring(0, 150) || '';
      agents.push({ name: agentName, description, plugin: pluginName, file: fullPath });
    }
  }

  const marketplaces = fs.readdirSync(pluginsDir);
  for (const marketplace of marketplaces) {
    const pluginsSubDir = path.join(pluginsDir, marketplace, 'plugins');
    if (!fs.existsSync(pluginsSubDir)) continue;
    for (const plugin of fs.readdirSync(pluginsSubDir)) {
      scanAgentsDir(path.join(pluginsSubDir, plugin, 'agents'), plugin);
    }
    // also check external_plugins (some may have agents)
    const extDir = path.join(pluginsDir, marketplace, 'external_plugins');
    if (!fs.existsSync(extDir)) continue;
    for (const plugin of fs.readdirSync(extDir)) {
      scanAgentsDir(path.join(extDir, plugin, 'agents'), plugin);
    }
  }

  return agents;
}

app.get('/api/agents', (req, res) => {
  res.json(discoverAgents());
});

// GET /api/skills/search — proxy to skills.sh API
app.get('/api/skills/search', async (req, res) => {
  const q = req.query.q;
  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.status(400).json({ error: 'Missing query parameter q' });
  }
  try {
    const url = `https://skills.sh/api/search?q=${encodeURIComponent(q.trim())}&limit=20`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach skills.sh', detail: err.message });
  }
});

// DELETE /api/skills — remove a skill file (must stay within CLAUDE_DIR)

app.delete('/api/skills', (req, res) => {
  const { file } = req.body;
  if (!file || typeof file !== 'string') {
    return res.status(400).json({ error: 'Missing file path' });
  }
  const cleanPath = path.normalize(file);
  if (!cleanPath.startsWith(CLAUDE_DIR) || !cleanPath.endsWith('.md')) {
    return res.status(403).json({ error: 'Path not permitted' });
  }
  if (!fs.existsSync(cleanPath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  moveToTrash(cleanPath, { type: 'skill' });
  res.json({ success: true });
});

// DELETE /api/agents — move an agent file to trash

app.delete('/api/agents', (req, res) => {
  const { file } = req.body;
  if (!file || typeof file !== 'string') {
    return res.status(400).json({ error: 'Missing file path' });
  }
  const cleanPath = path.normalize(file);
  if (!cleanPath.startsWith(CLAUDE_DIR) || !cleanPath.endsWith('.md')) {
    return res.status(403).json({ error: 'Path not permitted' });
  }
  if (!fs.existsSync(cleanPath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  moveToTrash(cleanPath, { type: 'agent' });
  res.json({ success: true });
});

// DELETE /api/mcp — remove a global MCP server from ~/.mcp.json

app.delete('/api/mcp', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    return res.status(400).json({ error: 'Invalid server name' });
  }
  const mcpPath = path.join(os.homedir(), '.mcp.json');
  const config = readJsonFile(mcpPath);
  if (!config?.mcpServers?.[name]) {
    return res.status(404).json({ error: 'Server not found in global config' });
  }
  delete config.mcpServers[name];
  fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2));
  res.json({ success: true });
});

// GET /api/trash — list trashed items

app.get('/api/trash', (req, res) => {
  if (!fs.existsSync(TRASH_DIR)) return res.json([]);
  const files = fs.readdirSync(TRASH_DIR).filter(f => f.endsWith('.json'));
  const items = files.map(f => {
    const meta = readJsonFile(path.join(TRASH_DIR, f));
    return meta;
  }).filter(Boolean).sort((a, b) => b.deletedAt?.localeCompare(a.deletedAt ?? '') ?? 0);
  res.json(items);
});

// POST /api/trash/restore — restore an item from trash to its original path

function isValidTrashId(id) {
  return typeof id === 'string' && /^[0-9]+-[^/\\]+\.md$/.test(id);
}

app.post('/api/trash/restore', (req, res) => {
  const { id } = req.body;
  if (!isValidTrashId(id)) {
    return res.status(400).json({ error: 'Invalid trash id' });
  }
  const meta = readJsonFile(path.join(TRASH_DIR, id.replace(/\.md$/, '.json')));
  if (!meta) return res.status(404).json({ error: 'Item not found in trash' });

  const originalPath = path.normalize(meta.originalPath);
  if (!originalPath.startsWith(CLAUDE_DIR) || !originalPath.endsWith('.md')) {
    return res.status(403).json({ error: 'Original path not permitted' });
  }

  const trashFile = path.join(TRASH_DIR, id);
  if (!fs.existsSync(trashFile)) return res.status(404).json({ error: 'Trash file missing' });

  fs.mkdirSync(path.dirname(originalPath), { recursive: true });
  fs.copyFileSync(trashFile, originalPath);
  fs.unlinkSync(trashFile);
  fs.unlinkSync(path.join(TRASH_DIR, id.replace(/\.md$/, '.json')));
  res.json({ success: true });
});

// DELETE /api/trash — permanently delete an item from trash

app.delete('/api/trash', (req, res) => {
  const { id } = req.body;
  if (!isValidTrashId(id)) {
    return res.status(400).json({ error: 'Invalid trash id' });
  }
  const trashFile = path.join(TRASH_DIR, id);
  const trashMeta = path.join(TRASH_DIR, id.replace(/\.md$/, '.json'));
  if (!fs.existsSync(trashFile)) return res.status(404).json({ error: 'Item not found' });
  fs.unlinkSync(trashFile);
  if (fs.existsSync(trashMeta)) fs.unlinkSync(trashMeta);
  res.json({ success: true });
});

// POST /api/exec (SECURITY: allowlist only)

const ALLOWED_COMMANDS = [
  /^claude plugin (install|remove) [a-zA-Z0-9@._/-]+$/,
  /^npx skills add [a-zA-Z0-9@._-]+(\/[a-zA-Z0-9@._-]+)?$/,
];

function isAllowed(cmd) {
  return ALLOWED_COMMANDS.some(pattern => pattern.test(cmd.trim()));
}

app.post('/api/exec', (req, res) => {
  const { cmd } = req.body;
  if (!cmd || typeof cmd !== 'string') {
    return res.status(400).json({ error: 'Missing cmd' });
  }
  if (!isAllowed(cmd)) {
    return res.status(403).json({ error: 'Command not permitted' });
  }
  const [command, ...args] = cmd.trim().split(/\s+/);
  const result = runCommand(command, args);
  res.json(result);
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Claude Dashboard running at http://127.0.0.1:${PORT}`);
});
