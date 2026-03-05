const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

const app = express();
const PORT = 3000;
const CLAUDE_DIR = path.join(os.homedir(), '.claude');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper functions

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
  fs.unlinkSync(cleanPath);
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
