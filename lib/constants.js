const path = require('path');
const os = require('os');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const TRASH_DIR = path.join(CLAUDE_DIR, '.dashboard-trash');
const PORT = 7777;

module.exports = { CLAUDE_DIR, TRASH_DIR, PORT };
