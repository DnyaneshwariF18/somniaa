import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, before, after } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

const somniaDbPath = resolve('somnia.db');
const backendPath = fileURLToPath(new URL('../server/index.mjs', import.meta.url));

let backendProcess;
let backendPort;
let baseUrl;

async function getFreePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((res, rej) => server.close((err) => err ? rej(err) : res()));
  return port;
}

before(async () => {
  backendPort = await getFreePort();
  baseUrl = `http://127.0.0.1:${backendPort}`;

  backendProcess = spawn(process.execPath, [backendPath], {
    cwd: resolve('.'),
    env: {
      ...process.env,
      SOMNIA_DB_PATH: somniaDbPath,
      SOMNIA_PORT: String(backendPort),
    },
    stdio: 'ignore',
  });

  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('Backend failed to start.');
});

after(async () => {
  if (backendProcess && backendProcess.exitCode === null) {
    backendProcess.kill('SIGTERM');
    await once(backendProcess, 'exit');
  }
});

test('Live somnia.db CRUD memory tests', async () => {
  // 1. Health check
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthRes.status, 200);
  const health = await healthRes.json();
  assert.equal(health.backend, 'ok');
  assert.equal(health.storage, 'sqlite');

  // 2. Create memory
  const createRes = await fetch(`${baseUrl}/api/memories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Always keep hydrated during coding sprints.' }),
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.ok(created.id, 'Memory has an ID');
  assert.equal(created.text, 'Always keep hydrated during coding sprints.');
  assert.equal(created.status, 'approved');
  assert.ok(created.createdAt);
  assert.ok(created.updatedAt);

  // 3. List memories
  const listRes = await fetch(`${baseUrl}/api/memories`);
  assert.equal(listRes.status, 200);
  const { memories } = await listRes.json();
  assert.ok(Array.isArray(memories));
  const found = memories.find((m) => m.id === created.id);
  assert.ok(found, 'Created memory appears in list');

  // 4. Retrieve single memory by ID
  const getRes = await fetch(`${baseUrl}/api/memories/${created.id}`);
  assert.equal(getRes.status, 200);
  const single = await getRes.json();
  assert.equal(single.id, created.id);
  assert.equal(single.text, created.text);

  // 5. Edit memory text and archive it
  const editRes = await fetch(`${baseUrl}/api/memories/${created.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Always keep well hydrated with water during coding sprints.',
      status: 'archived',
    }),
  });
  assert.equal(editRes.status, 200);
  const edited = await editRes.json();
  assert.equal(edited.text, 'Always keep well hydrated with water during coding sprints.');
  assert.equal(edited.status, 'archived');

  // 6. Approve memory via approve shortcut
  const approveRes = await fetch(`${baseUrl}/api/memories/${created.id}/approve`, {
    method: 'PATCH',
  });
  assert.equal(approveRes.status, 200);
  const approved = await approveRes.json();
  assert.equal(approved.status, 'approved');

  // 7. Verify directly in SQLite somnia.db
  const db = new DatabaseSync(somniaDbPath);
  const dbRow = db.prepare('SELECT id, text, status FROM memories WHERE id = ?').get(created.id);
  assert.equal(dbRow.text, 'Always keep well hydrated with water during coding sprints.');
  assert.equal(dbRow.status, 'approved');
  db.close();

  // 8. Delete memory
  const delRes = await fetch(`${baseUrl}/api/memories/${created.id}`, {
    method: 'DELETE',
  });
  assert.equal(delRes.status, 200);
  assert.deepEqual(await delRes.json(), { ok: true });

  // 9. Confirm 404 after deletion
  const getAfterDel = await fetch(`${baseUrl}/api/memories/${created.id}`);
  assert.equal(getAfterDel.status, 404);

  // 10. Confirm 404 on deleting again
  const delAgain = await fetch(`${baseUrl}/api/memories/${created.id}`, {
    method: 'DELETE',
  });
  assert.equal(delAgain.status, 404);

  // 11. Validation errors
  const emptyRes = await fetch(`${baseUrl}/api/memories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '    ' }),
  });
  assert.equal(emptyRes.status, 400);

  const badStatusRes = await fetch(`${baseUrl}/api/memories/any-id`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'unsupported-status' }),
  });
  assert.equal(badStatusRes.status, 400);
});
