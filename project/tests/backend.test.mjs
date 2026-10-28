import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'somnia-backend-test-'));
const databasePath = join(temporaryDirectory, 'test.sqlite');
const backendPath = fileURLToPath(new URL('../server/index.mjs', import.meta.url));
let backendProcess;
let backendUrl;
let providerUrl;
let capturedRequests = [];
let providerServer;

async function unusedPort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolveClose, reject) => {
    server.close((error) => error ? reject(error) : resolveClose());
  });
  return port;
}

before(async () => {
  const providerPort = await unusedPort();
  providerUrl = `http://127.0.0.1:${providerPort}/v1`;
  providerServer = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    capturedRequests.push({
      authorization: request.headers.authorization,
      body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
    });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      choices: [{ message: { content: 'Mock AI answer.' } }],
    }));
  });
  providerServer.listen(providerPort, '127.0.0.1');
  await once(providerServer, 'listening');

  const backendPort = await unusedPort();
  backendUrl = `http://127.0.0.1:${backendPort}`;
  backendProcess = spawn(process.execPath, [backendPath], {
    cwd: resolve('.'),
    env: {
      ...process.env,
      SOMNIA_AI_BASE_URL: providerUrl,
      SOMNIA_AI_API_KEY: 'test-key-not-a-real-secret',
      SOMNIA_AI_MODEL: 'test-model',
      SOMNIA_DB_PATH: databasePath,
      SOMNIA_PORT: String(backendPort),
    },
    stdio: 'ignore',
  });

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${backendUrl}/api/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    }
  }
  throw new Error('Backend did not start in time.');
});

after(async () => {
  if (backendProcess && backendProcess.exitCode === null) {
    backendProcess.kill('SIGTERM');
    await once(backendProcess, 'exit');
  }
  if (providerServer?.listening) {
    await new Promise((resolveClose, reject) => {
      providerServer.close((error) => error ? reject(error) : resolveClose());
    });
  }
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('persists data, gates external AI, retrieves approved context, and retries Sleep Cycle safely', async () => {
  const health = await fetch(`${backendUrl}/api/health`).then((response) => response.json());
  assert.equal(health.llm.configured, true);
  assert.equal(health.llm.mode, 'demo');

  const data = {
    version: 1,
    messages: [],
    memories: [
      {
        id: 'approved-memory',
        text: 'User study preference is concise notes.',
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
        status: 'approved',
      },
      {
        id: 'archived-memory',
        text: 'Archived private phrase should not be shared.',
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
        status: 'archived',
      },
    ],
    reminders: [],
    decisions: [],
    sleepRuns: [],
    theme: 'somnia',
    allowExternalAI: true,
  };
  const saved = await fetch(`${backendUrl}/api/data`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  assert.equal(saved.status, 200);

  const roundTrip = await fetch(`${backendUrl}/api/data`).then((response) => response.json());
  assert.equal(roundTrip.data.memories.length, 2);

  const duplicateMessages = await fetch(`${backendUrl}/api/data`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...data,
      messages: [
        { id: 'repeated-message-id', role: 'user', text: 'First message' },
        { id: 'repeated-message-id', role: 'somnia', text: 'Second message' },
      ],
    }),
  });
  assert.equal(duplicateMessages.status, 400);
  assert.match((await duplicateMessages.json()).error, /Duplicate chat message ID/);
  assert.equal(
    (await fetch(`${backendUrl}/api/data`).then((result) => result.json())).data.memories.length,
    2,
    'Rejected data must leave previously saved records unchanged.',
  );

  const response = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'What is my study preference?',
      history: [{ role: 'user', text: 'What is my study preference?' }],
      allowExternalAI: true,
    }),
  });
  const chat = await response.json();
  assert.equal(chat.mode, 'ai');
  assert.equal(chat.text, 'Mock AI answer.');
  assert.equal(capturedRequests.length, 1);
  assert.equal(capturedRequests[0].authorization, 'Bearer test-key-not-a-real-secret');
  assert.equal(capturedRequests[0].body.model, 'test-model');
  const providerContext = JSON.stringify(capturedRequests[0].body.messages);
  assert.match(providerContext, /User study preference is concise notes/);
  assert.doesNotMatch(providerContext, /Archived private phrase/);

  const gatedResponse = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Do not send this externally.',
      history: [],
      allowExternalAI: false,
    }),
  });
  assert.equal((await gatedResponse.json()).mode, 'demo');
  assert.equal(capturedRequests.length, 1);

  const cycleUrl = `${backendUrl}/api/sleep-cycle`;
  const cycleHeaders = {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'same-retry-key',
  };
  const firstRun = await fetch(cycleUrl, { method: 'POST', headers: cycleHeaders, body: '{}' })
    .then((result) => result.json());
  const retryRun = await fetch(cycleUrl, { method: 'POST', headers: cycleHeaders, body: '{}' })
    .then((result) => result.json());
  assert.equal(firstRun.data.sleepRuns.length, 1);
  assert.equal(retryRun.data.sleepRuns.length, 1);
  assert.deepEqual(retryRun.data.sleepRuns[0].staleMemoryIds, ['approved-memory']);
});
