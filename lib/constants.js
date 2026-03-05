const path = require('path');
const os = require('os');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const TRASH_DIR = path.join(CLAUDE_DIR, '.dashboard-trash');

module.exports = { CLAUDE_DIR, TRASH_DIR };
