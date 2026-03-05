const { runCommand } = require('../lib/helpers');

const ALLOWED_COMMANDS = [
  /^claude plugin (install|remove) [a-zA-Z0-9@._/-]+$/,
  /^npx skills add [a-zA-Z0-9@._-]+(\/[a-zA-Z0-9@._-]+)?$/,
];

function isAllowed(cmd) {
  return ALLOWED_COMMANDS.some(pattern => pattern.test(cmd.trim()));
}

module.exports = (app) => {
  app.post('/api/exec', (req, res) => {
    const { cmd } = req.body;
    if (!cmd || typeof cmd !== 'string') {
      return res.status(400).json({ error: 'Missing cmd' });
    }
    if (!isAllowed(cmd)) {
      return res.status(403).json({ error: 'Command not permitted' });
    }
    const [command, ...args] = cmd.trim().split(/\s+/);
    res.json(runCommand(command, args));
  });
};
