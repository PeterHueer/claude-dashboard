const fs = require('fs');
const path = require('path');
const { CLAUDE_DIR, TRASH_DIR } = require('../lib/constants');
const { readJsonFile, isValidTrashId } = require('../lib/helpers');

module.exports = (app) => {
  app.get('/api/trash', (req, res) => {
    if (!fs.existsSync(TRASH_DIR)) return res.json([]);
    const items = fs.readdirSync(TRASH_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => readJsonFile(path.join(TRASH_DIR, f)))
      .filter(Boolean)
      .sort((a, b) => b.deletedAt?.localeCompare(a.deletedAt ?? '') ?? 0);
    res.json(items);
  });

  app.post('/api/trash/restore', (req, res) => {
    const { id } = req.body;
    if (!isValidTrashId(id)) return res.status(400).json({ error: 'Invalid trash id' });

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

  app.delete('/api/trash', (req, res) => {
    const { id } = req.body;
    if (!isValidTrashId(id)) return res.status(400).json({ error: 'Invalid trash id' });

    const trashFile = path.join(TRASH_DIR, id);
    if (!fs.existsSync(trashFile)) return res.status(404).json({ error: 'Item not found' });

    fs.unlinkSync(trashFile);
    const trashMeta = path.join(TRASH_DIR, id.replace(/\.md$/, '.json'));
    if (fs.existsSync(trashMeta)) fs.unlinkSync(trashMeta);
    res.json({ success: true });
  });
};
