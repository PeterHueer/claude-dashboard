const fs = require('fs');
const path = require('path');
const os = require('os');
const { CLAUDE_DIR } = require('../lib/constants');
const { readJsonFile, moveToTrash } = require('../lib/helpers');

function validateMdPath(file) {
  if (!file || typeof file !== 'string') return { error: 'Missing file path', status: 400 };
  const cleanPath = path.normalize(file);
  if (!cleanPath.startsWith(CLAUDE_DIR) || !cleanPath.endsWith('.md')) {
    return { error: 'Path not permitted', status: 403 };
  }
  if (!fs.existsSync(cleanPath)) return { error: 'File not found', status: 404 };
  return { cleanPath };
}

module.exports = (app) => {
  app.delete('/api/skills', (req, res) => {
    const { error, status, cleanPath } = validateMdPath(req.body.file);
    if (error) return res.status(status).json({ error });
    moveToTrash(cleanPath, { type: 'skill' });
    res.json({ success: true });
  });

  app.delete('/api/agents', (req, res) => {
    const { error, status, cleanPath } = validateMdPath(req.body.file);
    if (error) return res.status(status).json({ error });
    moveToTrash(cleanPath, { type: 'agent' });
    res.json({ success: true });
  });

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
};
