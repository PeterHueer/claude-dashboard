const fs = require('fs');
const path = require('path');
const { CLAUDE_DIR } = require('../lib/constants');
const { readJsonFile } = require('../lib/helpers');

const SETTINGS_FILES = [
  { file: 'settings.json',       source: 'settings' },
  { file: 'settings.local.json', source: 'settings.local' },
];

function readAllPermissions() {
  const result = [];
  for (const { file, source } of SETTINGS_FILES) {
    const data = readJsonFile(path.join(CLAUDE_DIR, file)) || {};
    const perms = data.permissions || {};
    for (const type of ['allow', 'deny']) {
      for (const rule of perms[type] || []) {
        result.push({ rule, type, source });
      }
    }
  }
  return result;
}

module.exports = (app) => {
  app.get('/api/permissions', (req, res) => {
    res.json(readAllPermissions());
  });

  app.delete('/api/permissions', (req, res) => {
    const { rule, source } = req.body;
    if (!rule || typeof rule !== 'string') {
      return res.status(400).json({ error: 'Missing rule' });
    }

    const filename = source === 'settings.local' ? 'settings.local.json' : 'settings.json';
    const filePath = path.join(CLAUDE_DIR, filename);
    const data = readJsonFile(filePath) || {};

    if (!data.permissions) return res.status(404).json({ error: 'Permission not found' });

    let removed = false;
    for (const type of ['allow', 'deny']) {
      if (!Array.isArray(data.permissions[type])) continue;
      const before = data.permissions[type].length;
      data.permissions[type] = data.permissions[type].filter(r => r !== rule);
      if (data.permissions[type].length < before) removed = true;
      if (data.permissions[type].length === 0) delete data.permissions[type];
    }

    if (!removed) return res.status(404).json({ error: 'Permission not found' });
    if (Object.keys(data.permissions).length === 0) delete data.permissions;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.json({ success: true });
  });
};
