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

let mockNebiusServer;
let mockNebiusPort;
let mockNebiusUrl;
let backendProcess;
let backendPort;
let backendUrl;
let capturedNebiusRequests = [];

async function getFreePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((res, rej) => server.close((err) => err ? rej(err) : res()));
  return port;
}

before(async () => {
  // 1. Setup mock Nebius AI Studio server
  mockNebiusPort = await getFreePort();
  mockNebiusUrl = `http://127.0.0.1:${mockNebiusPort}/v1`;

  mockNebiusServer = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyStr = Buffer.concat(chunks).toString('utf8');
    const parsedBody = bodyStr ? JSON.parse(bodyStr) : {};

    capturedNebiusRequests.push({
      url: req.url,
      method: req.method,
      authorization: req.headers.authorization,
      contentType: req.headers['content-type'],
      body: parsedBody,
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: 'nebius-chat-12345',
      object: 'chat.completion',
      created: Date.now(),
      model: parsedBody.model || 'meta-llama/Meta-Llama-3.1-8B-Instruct',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello from Nebius AI! I recall your sleep and study preferences.',
          },
          finish_reason: 'stop',
        },
      ],
    }));
  });

  mockNebiusServer.listen(mockNebiusPort, '127.0.0.1');
  await once(mockNebiusServer, 'listening');

  // 2. Seed somnia.db with test memory records for retrieval check
  const db = new DatabaseSync(somniaDbPath);
  db.exec(`
    INSERT INTO app_settings (id, theme, allow_external_ai) VALUES (1, 'somnia', 1)
      ON CONFLICT(id) DO UPDATE SET allow_external_ai = 1;
    DELETE FROM memories WHERE id IN ('test-approved-memory', 'test-archived-memory');
    INSERT INTO memories (id, text, created_at, updated_at, status)
      VALUES ('test-approved-memory', 'User prefers warm lighting and early sleep routine.', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', 'approved');
    INSERT INTO memories (id, text, created_at, updated_at, status)
      VALUES ('test-archived-memory', 'Confidential note that must never be sent to external AI.', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', 'archived');
  `);
  db.close();

  // 3. Start backend configured for Nebius endpoint
  backendPort = await getFreePort();
  backendUrl = `http://127.0.0.1:${backendPort}`;

  backendProcess = spawn(process.execPath, [backendPath], {
    cwd: resolve('.'),
    env: {
      ...process.env,
      SOMNIA_AI_BASE_URL: mockNebiusUrl,
      SOMNIA_AI_API_KEY: 'mock-nebius-token',
      SOMNIA_AI_MODEL: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
      SOMNIA_DB_PATH: somniaDbPath,
      SOMNIA_PORT: String(backendPort),
    },
    stdio: 'ignore',
  });

  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${backendUrl}/api/health`);
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
  if (mockNebiusServer?.listening) {
    await new Promise((res, rej) => mockNebiusServer.close((err) => err ? rej(err) : res()));
  }
});

test('Nebius AI Integration: health status and configured mode', async () => {
  const healthRes = await fetch(`${backendUrl}/api/health`);
  assert.equal(healthRes.status, 200);
  const health = await healthRes.json();
  assert.equal(health.backend, 'ok');
  assert.equal(health.storage, 'sqlite');
  assert.equal(health.llm.configured, true);
  assert.equal(health.llm.enabled, true);
  assert.equal(health.llm.model, 'meta-llama/Meta-Llama-3.1-8B-Instruct');
  assert.equal(health.llm.mode, 'ai');
});

test('Nebius AI Integration: chat completions with approved memory retrieval', async () => {
  capturedNebiusRequests = [];

  const chatRes = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'What is my sleep routine preference?',
      history: [{ role: 'user', text: 'What is my sleep routine preference?' }],
      allowExternalAI: true,
    }),
  });

  assert.equal(chatRes.status, 200);
  const chat = await chatRes.json();
  assert.equal(chat.mode, 'ai');
  assert.match(chat.text, /Hello from Nebius AI/);

  // Verify external request payload sent to Nebius
  assert.equal(capturedNebiusRequests.length, 1);
  const req = capturedNebiusRequests[0];
  assert.equal(req.url, '/v1/chat/completions');
  assert.equal(req.method, 'POST');
  assert.equal(req.authorization, 'Bearer mock-nebius-token');
  assert.equal(req.body.model, 'meta-llama/Meta-Llama-3.1-8B-Instruct');

  // Verify memory retrieval in system prompt:
  const systemMessage = req.body.messages.find((m) => m.role === 'system');
  assert.ok(systemMessage, 'System message was constructed');
  assert.match(systemMessage.content, /User prefers warm lighting and early sleep routine/,
    'Approved memory matching prompt keywords was injected into prompt');
  assert.doesNotMatch(systemMessage.content, /Confidential note/,
    'Archived memory was excluded');
});

test('Nebius AI Integration: privacy gating when consent is false', async () => {
  capturedNebiusRequests = [];

  const gatedRes = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'What is my sleep routine preference?',
      history: [],
      allowExternalAI: false,
    }),
  });

  assert.equal(gatedRes.status, 200);
  const result = await gatedRes.json();
  assert.equal(result.mode, 'demo');
  assert.equal(capturedNebiusRequests.length, 0, 'No external request made when consent is disabled');
});
