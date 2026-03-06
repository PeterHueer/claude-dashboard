const fs = require('fs');
const path = require('path');
const os = require('os');
const { CLAUDE_DIR } = require('../lib/constants');
const { readJsonFile } = require('../lib/helpers');

function discoverMcpServers() {
  const servers = {};

  // 1. Servers from ~/.mcp.json enabled via enabledMcpjsonServers
  const settingsLocal = readJsonFile(path.join(CLAUDE_DIR, 'settings.local.json')) || {};
  const enabledNames = new Set(settingsLocal.enabledMcpjsonServers || []);

  const globalMcp = readJsonFile(path.join(os.homedir(), '.mcp.json'));
  if (globalMcp?.mcpServers) {
    Object.entries(globalMcp.mcpServers).forEach(([name, config]) => {
      if (!enabledNames.size || enabledNames.has(name)) {
        servers[name] = { name, ...config, source: 'global' };
      }
    });
  }

  // 2. External plugin MCP servers — active when enableAllProjectMcpServers is true
  if (settingsLocal.enableAllProjectMcpServers) {
    const pluginsDir = path.join(CLAUDE_DIR, 'plugins', 'marketplaces');
    if (fs.existsSync(pluginsDir)) {
      for (const marketplace of fs.readdirSync(pluginsDir)) {
        const extPluginsDir = path.join(pluginsDir, marketplace, 'external_plugins');
        if (!fs.existsSync(extPluginsDir)) continue;
        for (const plugin of fs.readdirSync(extPluginsDir)) {
          const mcp = readJsonFile(path.join(extPluginsDir, plugin, '.mcp.json'));
          if (!mcp) continue;
          const entries = mcp.mcpServers ? Object.entries(mcp.mcpServers) : Object.entries(mcp);
          entries.forEach(([name, config]) => {
            if (!servers[name]) {
              servers[name] = { name, ...config, source: `plugin:${plugin}` };
            }
          });
        }
      }
    }
  }

  return Object.values(servers);
}

function discoverPlugins() {
  const plugins = [];
  const seen = new Set();

  // Only show enabled plugins, keyed as "name@marketplace"
  const settings = readJsonFile(path.join(CLAUDE_DIR, 'settings.json')) || {};
  const enabledPlugins = Object.keys(settings.enabledPlugins || {});
  if (!enabledPlugins.length) return plugins;

  const cacheDir = path.join(CLAUDE_DIR, 'plugins', 'cache');

  for (const key of enabledPlugins) {
    const atIdx = key.lastIndexOf('@');
    const pluginName = atIdx === -1 ? key : key.slice(0, atIdx);
    const marketplace = atIdx === -1 ? null : key.slice(atIdx + 1);
    if (seen.has(pluginName)) continue;

    // Read plugin.json from cache: cache/{marketplace}/{pluginName}/{version}/.claude-plugin/plugin.json
    let meta = null;
    if (marketplace) {
      const pluginCacheDir = path.join(cacheDir, marketplace, pluginName);
      const ver = latestVersion(pluginCacheDir);
      if (ver) {
        meta = readJsonFile(path.join(pluginCacheDir, ver, '.claude-plugin', 'plugin.json'));
      }
    }

    // Fallback: scan marketplace source dirs
    if (!meta) {
      const pluginsDir = path.join(CLAUDE_DIR, 'plugins', 'marketplaces');
      if (marketplace && fs.existsSync(pluginsDir)) {
        const marketplaceDir = path.join(pluginsDir, marketplace);
        // Try plugins/ subdir
        const fromPlugins = readJsonFile(path.join(marketplaceDir, 'plugins', pluginName, '.claude-plugin', 'plugin.json'));
        // Try external_plugins/ subdir
        const fromExternal = readJsonFile(path.join(marketplaceDir, 'external_plugins', pluginName, '.claude-plugin', 'plugin.json'));
        meta = fromPlugins || fromExternal;
      }
    }

    if (!meta || meta.name !== pluginName) continue;
    seen.add(pluginName);

    // Determine type: external_plugins → mcp, otherwise skill
    const isExternal = marketplace && fs.existsSync(
      path.join(CLAUDE_DIR, 'plugins', 'marketplaces', marketplace, 'external_plugins', pluginName)
    );
    plugins.push({
      name: meta.name,
      description: meta.description || '',
      version: meta.version || null,
      author: meta.author?.name || null,
      type: isExternal ? 'mcp' : 'skill',
      marketplace: marketplace || '',
    });
  }

  // Also include installed external_plugins (MCP type) — tracked by directory presence
  const pluginsDir = path.join(CLAUDE_DIR, 'plugins', 'marketplaces');
  if (fs.existsSync(pluginsDir)) {
    for (const marketplace of fs.readdirSync(pluginsDir)) {
      const extDir = path.join(pluginsDir, marketplace, 'external_plugins');
      if (!fs.existsSync(extDir)) continue;
      for (const pluginName of fs.readdirSync(extDir)) {
        if (seen.has(pluginName)) continue;
        const meta = readJsonFile(path.join(extDir, pluginName, '.claude-plugin', 'plugin.json'));
        if (!meta) continue;
        seen.add(pluginName);
        plugins.push({
          name: meta.name || pluginName,
          description: meta.description || '',
          version: meta.version || null,
          author: meta.author?.name || null,
          type: 'mcp',
          marketplace,
        });
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
