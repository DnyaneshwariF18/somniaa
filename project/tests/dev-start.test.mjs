import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { after, test } from 'node:test';

let launcherProcess;

after(async () => {
  if (launcherProcess && launcherProcess.exitCode === null) {
    launcherProcess.kill('SIGTERM');
    await once(launcherProcess, 'exit');
  }
});

test('npm dev launcher reuses a healthy backend already on its port', async () => {
  const backend = createServer((request, response) => {
    if (request.url === '/api/health') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ backend: 'ok', storage: 'sqlite' }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  backend.listen(0, '127.0.0.1');
  await once(backend, 'listening');
  const { port } = backend.address();

  try {
    launcherProcess = spawn(process.execPath, ['scripts/dev.mjs'], {
      cwd: resolve('.'),
      env: { ...process.env, SOMNIA_PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    const startupOutput = new Promise((resolveOutput, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Development launcher did not start in time.\n${output}`));
      }, 20000);
      const inspectOutput = (chunk) => {
        output += chunk.toString();
        if (
          output.includes(`Somnia backend is already running on port ${port}; reusing it.`) &&
          output.includes('http://localhost:')
        ) {
          cleanup();
          resolveOutput(output);
        }
      };
      const onExit = (code) => {
        cleanup();
        reject(new Error(`Development launcher exited with code ${code}.\n${output}`));
      };
      const cleanup = () => {
        clearTimeout(timeout);
        launcherProcess.stdout.off('data', inspectOutput);
        launcherProcess.stderr.off('data', inspectOutput);
        launcherProcess.off('exit', onExit);
      };
      launcherProcess.stdout.on('data', inspectOutput);
      launcherProcess.stderr.on('data', inspectOutput);
      launcherProcess.once('exit', onExit);
    });

    const outputAfterStartup = await startupOutput;
    assert.match(outputAfterStartup, /reusing it/);
    assert.doesNotMatch(outputAfterStartup, /EADDRINUSE/);
  } finally {
    if (launcherProcess && launcherProcess.exitCode === null) {
      launcherProcess.kill('SIGTERM');
      await once(launcherProcess, 'exit');
    }
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200, 'the reused backend must remain running when the launcher exits');
    await new Promise((resolveClose, reject) => {
      backend.close((error) => error ? reject(error) : resolveClose());
    });
  }
});
