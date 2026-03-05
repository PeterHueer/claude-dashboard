const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { TRASH_DIR } = require('./constants');

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

function isValidTrashId(id) {
  return typeof id === 'string' && /^[0-9]+-[^/\\]+\.md$/.test(id);
}

module.exports = { readJsonFile, runCommand, moveToTrash, isValidTrashId };
