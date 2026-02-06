#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Parse CLI args
const args = process.argv.slice(2);
let port = 3000;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    const parsed = parseInt(args[i + 1], 10);
    if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
      port = parsed;
    }
    i++;
  }
}

// Detect workspace from cwd
import { existsSync } from 'node:fs';

function detectWorkspace(cwd) {
  const root = '/';

  // Look for .claude directory first
  let dir = cwd;
  while (dir !== root) {
    if (existsSync(resolve(dir, '.claude'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }

  // Then .git
  dir = cwd;
  while (dir !== root) {
    if (existsSync(resolve(dir, '.git'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }

  // Then package.json
  dir = cwd;
  while (dir !== root) {
    if (existsSync(resolve(dir, 'package.json'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }

  return cwd;
}

async function main() {
  const workspace = detectWorkspace(process.cwd());

  console.log(`claude-web starting...`);
  console.log(`  Workspace: ${workspace}`);
  console.log(`  Port: ${port}`);

  // Set environment variables
  process.env.CLAUDE_WEB_WORKSPACE = workspace;
  process.env.PORT = String(port);

  // Spawn next dev
  const nextBin = resolve(projectRoot, 'node_modules', '.bin', 'next');
  const child = spawn(nextBin, ['dev', '--port', String(port)], {
    cwd: projectRoot,
    stdio: 'pipe',
    env: { ...process.env },
  });

  let opened = false;

  child.stdout.on('data', (data) => {
    const text = data.toString();
    process.stdout.write(text);

    if (!opened && text.includes('Ready')) {
      opened = true;
      import('open').then((mod) => {
        const openFn = mod.default || mod;
        openFn(`http://localhost:${port}`);
      }).catch(() => {
        console.log(`  Open http://localhost:${port} in your browser`);
      });
    }
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  // Handle graceful shutdown
  function shutdown() {
    console.log('\nShutting down...');
    child.kill('SIGTERM');
    setTimeout(() => {
      child.kill('SIGKILL');
      process.exit(0);
    }, 5000);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start claude-web:', err);
  process.exit(1);
});
