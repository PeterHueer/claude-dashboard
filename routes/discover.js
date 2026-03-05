const fs = require('fs');
const path = require('path');
const os = require('os');
const { CLAUDE_DIR } = require('../lib/constants');
const { readJsonFile } = require('../lib/helpers');

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
    for (const marketplace of fs.readdirSync(pluginsDir)) {
      const extPluginsDir = path.join(pluginsDir, marketplace, 'external_plugins');
      if (!fs.existsSync(extPluginsDir)) continue;
      for (const plugin of fs.readdirSync(extPluginsDir)) {
        const mcp = readJsonFile(path.join(extPluginsDir, plugin, '.mcp.json'));
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

function discoverPlugins() {
  const plugins = [];
  const pluginsDir = path.join(CLAUDE_DIR, 'plugins', 'marketplaces');
  if (!fs.existsSync(pluginsDir)) return plugins;

  for (const marketplace of fs.readdirSync(pluginsDir)) {
    for (const category of ['plugins', 'external_plugins']) {
      const categoryDir = path.join(pluginsDir, marketplace, category);
      if (!fs.existsSync(categoryDir)) continue;
      for (const item of fs.readdirSync(categoryDir)) {
        const meta = readJsonFile(path.join(categoryDir, item, '.claude-plugin', 'plugin.json'));
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

function discoverSkills() {
  const skills = [];
  const pluginsDir = path.join(CLAUDE_DIR, 'plugins', 'marketplaces');
  if (!fs.existsSync(pluginsDir)) return skills;

  function scanSkillsDir(dir, pluginName) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
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

  for (const marketplace of fs.readdirSync(pluginsDir)) {
    const pluginsSubDir = path.join(pluginsDir, marketplace, 'plugins');
    if (!fs.existsSync(pluginsSubDir)) continue;
    for (const plugin of fs.readdirSync(pluginsSubDir)) {
      scanSkillsDir(path.join(pluginsSubDir, plugin, 'skills'), plugin);
    }
  }

  return skills;
}

function discoverAgents() {
  const agents = [];
  const pluginsDir = path.join(CLAUDE_DIR, 'plugins', 'marketplaces');
  if (!fs.existsSync(pluginsDir)) return agents;

  function scanAgentsDir(dir, pluginName) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const fullPath = path.join(dir, entry.name);
      const content = fs.readFileSync(fullPath, 'utf8');
      const nameMatch = content.match(/^name:\s*(.+)$/m);
      const descMatch = content.match(/^description:\s*(.+)$/m)
        || content.match(/^description:\s*\|\s*\n\s*(.+)$/m);
      const agentName = nameMatch?.[1]?.trim() || path.basename(entry.name, '.md');
      const description = descMatch?.[1]?.trim().replace(/<[^>]+>/g, '').substring(0, 150) || '';
      agents.push({ name: agentName, description, plugin: pluginName, file: fullPath });
    }
  }

  for (const marketplace of fs.readdirSync(pluginsDir)) {
    const pluginsSubDir = path.join(pluginsDir, marketplace, 'plugins');
    if (fs.existsSync(pluginsSubDir)) {
      for (const plugin of fs.readdirSync(pluginsSubDir)) {
        scanAgentsDir(path.join(pluginsSubDir, plugin, 'agents'), plugin);
      }
    }
    const extDir = path.join(pluginsDir, marketplace, 'external_plugins');
    if (fs.existsSync(extDir)) {
      for (const plugin of fs.readdirSync(extDir)) {
        scanAgentsDir(path.join(extDir, plugin, 'agents'), plugin);
      }
    }
  }

  return agents;
}

module.exports = (app) => {
  app.get('/api/mcp', (req, res) => res.json(discoverMcpServers()));
  app.get('/api/plugins', (req, res) => res.json(discoverPlugins()));
  app.get('/api/skills', (req, res) => res.json(discoverSkills()));
  app.get('/api/agents', (req, res) => res.json(discoverAgents()));

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
};
