#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');
const readline = require('readline');

const DEST = path.join(os.homedir(), '.claude', 'dashboard');
const SRC = path.join(__dirname, '..');

const COPY_ITEMS = [
  'server.js',
  'lib',
  'routes',
  'public',
  'scripts',
  '.claude-plugin',
  'package.json',
  'install.sh',
  'example.png',
  'README.md',
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function run(cmd, args = [], cwd = DEST) {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim().toLowerCase()); }));
}

async function install() {
  console.log('\nInstalling Claude Dashboard...\n');

  // 1. Copy files
  console.log(`Copying files to ${DEST}...`);
  fs.mkdirSync(DEST, { recursive: true });
  for (const item of COPY_ITEMS) {
    const src = path.join(SRC, item);
    if (fs.existsSync(src)) {
      copyRecursive(src, path.join(DEST, item));
    }
  }
  console.log('Files copied.\n');

  // 2. npm install
  console.log('Installing server dependencies...');
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--silent']);
  console.log('Dependencies installed.\n');

  // 3. Make scripts executable (macOS / Linux)
  if (process.platform !== 'win32') {
    execSync(`chmod +x ${DEST}/scripts/start.sh ${DEST}/scripts/stop.sh ${DEST}/scripts/remove.sh`);
  }

  // 4. Register Claude Code marketplace
  const claudeCmd = process.platform === 'win32' ? 'claude.cmd' : 'claude';
  const ans = await ask('Register as Claude Code plugin? (enables /dashboard:open and /dashboard:stop) [y/N] ');
  if (ans === 'y' || ans === 'yes') {
    console.log('\nRegistering Claude Code marketplace...');
    run(claudeCmd, ['plugin', 'marketplace', 'add', DEST], os.homedir());
    console.log('Installing plugin...');
    run(claudeCmd, ['plugin', 'install', 'dashboard@claude-dashboard'], os.homedir());
    console.log('Plugin installed.\n');
  }

  console.log('Done! Claude Dashboard installed.');
  console.log(`\n  Start:  bash ${DEST}/scripts/start.sh`);
  console.log(`  Stop:   bash ${DEST}/scripts/stop.sh`);
  console.log(`  Open:   http://127.0.0.1:7777`);
  if (ans === 'y' || ans === 'yes') {
    console.log('\n  Or use /dashboard:open in Claude Code.\n');
  } else {
    console.log('');
  }
}

const [,, command] = process.argv;

if (!command || command === 'help') {
  console.log('Usage: npx claude-dashboard <command>');
  console.log('');
  console.log('Commands:');
  console.log('  install   Install the dashboard to ~/.claude/dashboard');
  console.log('  help      Show this help message');
  process.exit(0);
}

if (command === 'install') {
  install().catch(err => { console.error(err.message); process.exit(1); });
} else {
  console.error(`Unknown command: ${command}`);
  console.error('Run: npx claude-dashboard help');
  process.exit(1);
}
