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
  const seen = new Set();
  const pluginsDir = path.join(CLAUDE_DIR, 'plugins', 'marketplaces');
  if (!fs.existsSync(pluginsDir)) return plugins;

  // Only show enabled plugins
  const settings = readJsonFile(path.join(CLAUDE_DIR, 'settings.json')) || {};
  const enabledPlugins = new Set(Object.keys(settings.enabledPlugins || {}).map(k => k.split('@')[0]));

  function addPlugin(meta, marketplaceName, type) {
    if (!meta || seen.has(meta.name)) return;
    if (!enabledPlugins.has(meta.name)) return;
    seen.add(meta.name);
    plugins.push({
      name: meta.name,
      description: meta.description || '',
      version: meta.version || null,
      author: meta.author?.name || null,
      type,
      marketplace: marketplaceName,
    });
  }

  for (const marketplace of fs.readdirSync(pluginsDir)) {
    const marketplaceDir = path.join(pluginsDir, marketplace);

    // 1. Read marketplace.json to find plugins listed there
    const marketplaceMeta = readJsonFile(path.join(marketplaceDir, '.claude-plugin', 'marketplace.json'));
    if (marketplaceMeta?.plugins) {
      for (const entry of marketplaceMeta.plugins) {
        const source = typeof entry.source === 'string' ? entry.source : '.';
        const sourceDir = path.resolve(marketplaceDir, source);
        const meta = readJsonFile(path.join(sourceDir, 'plugin.json'));
        addPlugin(meta, marketplace, 'skill');
      }
    }

    // 2. Scan plugins/ and external_plugins/ subdirectories (other marketplaces)
    for (const category of ['plugins', 'external_plugins']) {
      const categoryDir = path.join(marketplaceDir, category);
      if (!fs.existsSync(categoryDir)) continue;
      for (const item of fs.readdirSync(categoryDir)) {
        const meta = readJsonFile(path.join(categoryDir, item, '.claude-plugin', 'plugin.json'));
        addPlugin(meta, marketplace, category === 'external_plugins' ? 'mcp' : 'skill');
      }
    }
  }

  return plugins;
}

function latestVersion(dir) {
  if (!fs.existsSync(dir)) return null;
  const versions = fs.readdirSync(dir).filter(v => fs.statSync(path.join(dir, v)).isDirectory());
  if (!versions.length) return null;
  return versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).at(0);
}

function readSkillFile(fullPath, pluginName, source) {
  const content = fs.readFileSync(fullPath, 'utf8');
  const nameMatch = content.match(/^name:\s*["']?(.+?)["']?$/m);
  const descMatch = content.match(/^description:\s*["']?(.+?)["']?$/m);
  const skillName = nameMatch?.[1]?.trim() || path.basename(path.dirname(fullPath));
  const description = descMatch?.[1]?.trim().replace(/\\"/g, '"') || '';
  return { name: skillName, description, plugin: pluginName, file: fullPath, source };
}

function discoverSkills() {
  const skills = [];
  const seen = new Set();

  function add(skill) {
    if (seen.has(skill.name)) return;
    seen.add(skill.name);
    skills.push(skill);
  }

  // 1. User skills from ~/.claude/skills/
  const userSkillsDir = path.join(CLAUDE_DIR, 'skills');
  if (fs.existsSync(userSkillsDir)) {
    for (const entry of fs.readdirSync(userSkillsDir)) {
      const entryPath = path.join(userSkillsDir, entry);
      try {
        const stat = fs.statSync(entryPath); // follows symlinks
        if (!stat.isDirectory()) continue;
        const skillFile = path.join(entryPath, 'SKILL.md');
        if (fs.existsSync(skillFile)) {
          add(readSkillFile(skillFile, 'user', 'user'));
        }
      } catch { continue; }
    }
  }

  // 2. Plugin skills from cache
  function scanPluginCache(pluginDir, pluginName) {
    const ver = latestVersion(pluginDir);
    if (!ver) return;
    const skillsDir = path.join(pluginDir, ver, 'skills');
    if (!fs.existsSync(skillsDir)) return;
    for (const skillEntry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!skillEntry.isDirectory()) continue;
      const skillFile = path.join(skillsDir, skillEntry.name, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        add(readSkillFile(skillFile, pluginName, 'plugin'));
      }
    }
  }

  const cacheDir = path.join(CLAUDE_DIR, 'plugins', 'cache');
  if (fs.existsSync(cacheDir)) {
    for (const marketplace of fs.readdirSync(cacheDir)) {
      const marketplaceDir = path.join(cacheDir, marketplace);
      if (!fs.statSync(marketplaceDir).isDirectory()) continue;
      for (const plugin of fs.readdirSync(marketplaceDir)) {
        scanPluginCache(path.join(marketplaceDir, plugin), plugin);
      }
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
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

// Extract initialSkills array embedded in skills.sh Next.js RSC payload
async function fetchSkillsBrowse(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const html = await res.text();
  // Data lives inside a __next_f.push JS string — quotes are escaped as \"
  const marker = '\\"initialSkills\\":[{';
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = idx + marker.length - 2; // rewind to the [
  let depth = 0, i = start;
  for (; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') { depth--; if (depth === 0) break; }
  }
  // Unescape the JSON-within-JS-string, then parse
  const raw = html.slice(start, i + 1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  return JSON.parse(raw);
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

  const browseRoutes = {
    '/api/browse/alltime':  'https://skills.sh/',
    '/api/browse/trending': 'https://skills.sh/trending',
    '/api/browse/hot':      'https://skills.sh/hot',
  };

  for (const [route, url] of Object.entries(browseRoutes)) {
    app.get(route, async (req, res) => {
      try {
        const skills = await fetchSkillsBrowse(url);
        if (!skills) return res.status(502).json({ error: 'Could not parse skills.sh page' });
        res.json(skills);
      } catch (err) {
        res.status(502).json({ error: 'Failed to reach skills.sh', detail: err.message });
      }
    });
  }
};
