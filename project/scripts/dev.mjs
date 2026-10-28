import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve('.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);
const backendPort = process.env.SOMNIA_PORT ?? '8787';
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill();
  }
  process.exitCode = code;
}

function start(command, args) {
  const child = spawn(command, args, { stdio: 'inherit' });
  children.push(child);
  child.on('error', (error) => {
    console.error(`Somnia development process failed: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) {
      if (code !== 0) console.error(`Somnia development process exited with code ${code ?? 'unknown'}.`);
      stop(code ?? 1);
    }
  });
  return child;
}

async function waitForBackend(child) {
  const healthUrl = `http://127.0.0.1:${backendPort}/api/health`;
  const deadline = Date.now() + 15000;
  let lastError = 'Backend did not become ready.';

  while (Date.now() < deadline && !stopping) {
    if (child.exitCode !== null) {
      throw new Error(`Backend exited before becoming ready (code ${child.exitCode}).`);
    }
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        const status = await response.json();
        if (status.backend === 'ok' && status.storage === 'sqlite') return;
        lastError = 'Backend health check returned an unexpected response.';
      } else {
        lastError = `Backend health check returned HTTP ${response.status}.`;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Backend health check failed.';
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Could not start the Somnia backend at ${healthUrl}. ${lastError}`);
}

async function findExistingBackend() {
  const healthUrl = `http://127.0.0.1:${backendPort}/api/health`;
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1000) });
    if (!response.ok) return false;
    const status = await response.json();
    return status.backend === 'ok' && status.storage === 'sqlite';
  } catch {
    return false;
  }
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

try {
  const backendAlreadyRunning = await findExistingBackend();
  if (backendAlreadyRunning) {
    console.log(`Somnia backend is already running on port ${backendPort}; reusing it.`);
  } else {
    const backend = start(process.execPath, ['server/index.mjs']);
    await waitForBackend(backend);
    console.log('Somnia backend is ready.');
  }

  if (!stopping) {
    console.log('Starting the frontend...');
    start(process.execPath, ['node_modules/vite/bin/vite.js']);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Somnia development startup failed.');
  stop(1);
}
