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

test('memory CRUD endpoints work correctly', async () => {
  // ── Create ────────────────────────────────────────────────────────────────
  const createResponse = await fetch(`${backendUrl}/api/memories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'I prefer dark mode interfaces.' }),
  });
  assert.equal(createResponse.status, 201, 'create returns 201');
  const created = await createResponse.json();
  assert.equal(typeof created.id, 'string', 'has id');
  assert.equal(created.text, 'I prefer dark mode interfaces.');
  assert.equal(created.status, 'approved', 'new memory is approved by default');
  assert.equal(typeof created.createdAt, 'string', 'has createdAt');
  assert.equal(typeof created.updatedAt, 'string', 'has updatedAt');

  // ── List ──────────────────────────────────────────────────────────────────
  const listResponse = await fetch(`${backendUrl}/api/memories`);
  assert.equal(listResponse.status, 200);
  const { memories } = await listResponse.json();
  assert.ok(Array.isArray(memories), 'memories is an array');
  const found = memories.find((m) => m.id === created.id);
  assert.ok(found, 'created memory appears in list');

  // ── Get by ID ─────────────────────────────────────────────────────────────
  const getResponse = await fetch(`${backendUrl}/api/memories/${created.id}`);
  assert.equal(getResponse.status, 200);
  const fetched = await getResponse.json();
  assert.equal(fetched.id, created.id);
  assert.equal(fetched.text, created.text);

  // ── Edit text + status → archived ─────────────────────────────────────────
  const editResponse = await fetch(`${backendUrl}/api/memories/${created.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'I prefer dark mode interfaces (updated).', status: 'archived' }),
  });
  assert.equal(editResponse.status, 200);
  const edited = await editResponse.json();
  assert.equal(edited.text, 'I prefer dark mode interfaces (updated).');
  assert.equal(edited.status, 'archived');
  assert.notEqual(edited.updatedAt, created.updatedAt, 'updatedAt changes on edit');

  // ── Approve shortcut ──────────────────────────────────────────────────────
  const approveResponse = await fetch(`${backendUrl}/api/memories/${created.id}/approve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  });
  assert.equal(approveResponse.status, 200);
  const approved = await approveResponse.json();
  assert.equal(approved.status, 'approved');

  // ── Input validation ──────────────────────────────────────────────────────
  const emptyText = await fetch(`${backendUrl}/api/memories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '   ' }),
  });
  assert.equal(emptyText.status, 400, 'rejects blank text');

  const badStatus = await fetch(`${backendUrl}/api/memories/${created.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'pending' }),
  });
  assert.equal(badStatus.status, 400, 'rejects invalid status');

  const emptyPatch = await fetch(`${backendUrl}/api/memories/${created.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(emptyPatch.status, 400, 'rejects empty patch body');

  // ── 404 on unknown ID ─────────────────────────────────────────────────────
  const notFound = await fetch(`${backendUrl}/api/memories/does-not-exist`);
  assert.equal(notFound.status, 404);
  assert.match((await notFound.json()).error, /not found/i);

  const approveNotFound = await fetch(`${backendUrl}/api/memories/does-not-exist/approve`, {
    method: 'PATCH',
  });
  assert.equal(approveNotFound.status, 404);

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteResponse = await fetch(`${backendUrl}/api/memories/${created.id}`, {
    method: 'DELETE',
  });
  assert.equal(deleteResponse.status, 200);
  assert.deepEqual(await deleteResponse.json(), { ok: true });

  // Confirm it is gone
  const afterDelete = await fetch(`${backendUrl}/api/memories/${created.id}`);
  assert.equal(afterDelete.status, 404, 'deleted memory is no longer retrievable');

  // Delete non-existent → 404
  const deleteAgain = await fetch(`${backendUrl}/api/memories/${created.id}`, {
    method: 'DELETE',
  });
  assert.equal(deleteAgain.status, 404, 'deleting a non-existent memory returns 404');
});

test('retrieval supports paraphrased queries, word variations, follow-up conversation history, and excludes archived memories', async () => {
  // Populate database with controlled dataset
  const testData = {
    version: 1,
    messages: [],
    memories: [
      {
        id: 'mem-internship',
        text: 'I work in Pune as an intern at Google.',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        status: 'approved',
      },
      {
        id: 'mem-study',
        text: 'User study preference is concise notes.',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        status: 'approved',
      },
      {
        id: 'mem-archived-internship',
        text: 'Confidential archived internship details in London should stay secret.',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        status: 'archived',
      },
      {
        id: 'mem-archived-study',
        text: 'Archived obsolete studying habit of flashcards.',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        status: 'archived',
      },
    ],
    reminders: [],
    decisions: [
      {
        id: 'dec-1',
        title: 'Adopted TypeScript for backend services',
        context: 'Evaluating JavaScript vs TypeScript for maintainability',
        options: '["JavaScript", "TypeScript"]',
        reasoning: 'Better static guarantees and developer experience',
        expectedOutcome: 'Fewer runtime errors',
        reviewDate: '2026-12-31',
        actualOutcome: 'Fewer bugs during integration',
        lesson: 'Type safety is worth the build step',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    sleepRuns: [],
    theme: 'somnia',
    allowExternalAI: true,
  };

  const setupResponse = await fetch(`${backendUrl}/api/data`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testData),
  });
  assert.equal(setupResponse.status, 200);

  // ── 1. Paraphrased query: "Where is my internship?" ──────────────────────
  // Should match "I work in Pune as an intern at Google" despite wording differences
  capturedRequests = [];
  const paraphraseResponse = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Where is my internship?',
      history: [],
      allowExternalAI: true,
    }),
  });
  assert.equal(paraphraseResponse.status, 200);
  assert.equal(capturedRequests.length, 1);
  const paraphraseContext = JSON.stringify(capturedRequests[0].body.messages);
  assert.match(paraphraseContext, /I work in Pune as an intern at Google/);
  assert.doesNotMatch(paraphraseContext, /Confidential archived internship/);

  // ── 2. Word variations & stemming: "studying routines and preferences" ────
  capturedRequests = [];
  const variationResponse = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Tell me about my studying routines and preferences.',
      history: [],
      allowExternalAI: true,
    }),
  });
  assert.equal(variationResponse.status, 200);
  assert.equal(capturedRequests.length, 1);
  const variationContext = JSON.stringify(capturedRequests[0].body.messages);
  assert.match(variationContext, /User study preference is concise notes/);
  assert.doesNotMatch(variationContext, /Archived obsolete studying habit/);

  // ── 3. Follow-up query using conversation history ────────────────────────
  // Query "What city is that in?" has no direct "intern" or "Google",
  // but history provides conversational context
  capturedRequests = [];
  const followUpResponse = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'What city is that in?',
      history: [
        { role: 'user', text: 'Tell me about my internship at Google' },
        { role: 'somnia', text: 'You work in Pune as an intern at Google.' },
      ],
      allowExternalAI: true,
    }),
  });
  assert.equal(followUpResponse.status, 200);
  assert.equal(capturedRequests.length, 1);
  const followUpContext = JSON.stringify(capturedRequests[0].body.messages);
  assert.match(followUpContext, /I work in Pune as an intern at Google/);

  // ── 4. Archived memories must NEVER enter AI prompt ───────────────────────
  capturedRequests = [];
  const archivedQueryResponse = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Tell me about London or flashcards.',
      history: [],
      allowExternalAI: true,
    }),
  });
  assert.equal(archivedQueryResponse.status, 200);
  assert.equal(capturedRequests.length, 1);
  const systemPrompt = capturedRequests[0].body.messages.find((m) => m.role === 'system')?.content ?? '';
  assert.doesNotMatch(systemPrompt, /London/);
  assert.doesNotMatch(systemPrompt, /flashcards/);
  assert.doesNotMatch(systemPrompt, /Confidential archived internship/);
  assert.doesNotMatch(systemPrompt, /Archived obsolete/);
  assert.doesNotMatch(systemPrompt, /Relevant approved memories/);

  // ── 5. Follow-up with decision context ───────────────────────────────────
  capturedRequests = [];
  const decisionQueryResponse = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Why did we choose that language?',
      history: [
        { role: 'user', text: 'Did we make any decision regarding TypeScript backend?' },
        { role: 'somnia', text: 'Yes, you chose TypeScript over Python for maintainability.' },
      ],
      allowExternalAI: true,
    }),
  });
  assert.equal(decisionQueryResponse.status, 200);
  assert.equal(capturedRequests.length, 1);
  const decisionContext = JSON.stringify(capturedRequests[0].body.messages);
  assert.match(decisionContext, /Adopted TypeScript for backend services/);
});

test('memory proposal extraction: detects explicit facts, rejects hypotheticals, handles duplicates, respects consent gating, and supports approval', async () => {
  // 1. Setup baseline data
  const data = {
    version: 1,
    messages: [],
    memories: [
      {
        id: 'existing-work-mem',
        text: 'I work in Pune as an intern at Google.',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        status: 'approved',
      },
    ],
    reminders: [],
    decisions: [],
    sleepRuns: [],
    theme: 'somnia',
    allowExternalAI: true,
  };
  await fetch(`${backendUrl}/api/data`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  // 2. Proposal Creation: Explicit preference stated by user
  const prefRes = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'I prefer reading physical books rather than ebooks.',
      history: [],
      allowExternalAI: true,
    }),
  });
  assert.equal(prefRes.status, 200);
  const prefJson = await prefRes.json();
  assert.equal(prefJson.mode, 'ai');
  assert.ok(Array.isArray(prefJson.proposals), 'proposals is an array');
  assert.equal(prefJson.proposals.length, 1);
  assert.match(prefJson.proposals[0], /I prefer reading physical books rather than ebooks/i);

  // 3. Rejects Hypotheticals, Questions, and Quoted text
  // 3a. Hypothetical "what if" question
  const hypoRes = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'What if I prefer tea over coffee?',
      history: [],
      allowExternalAI: true,
    }),
  });
  const hypoJson = await hypoRes.json();
  assert.deepEqual(hypoJson.proposals, [], 'hypothetical questions must not generate proposals');

  // 3b. Speculation / condition "Suppose I work at Microsoft"
  const supposeRes = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Suppose I work at Microsoft as a designer.',
      history: [],
      allowExternalAI: true,
    }),
  });
  const supposeJson = await supposeRes.json();
  assert.deepEqual(supposeJson.proposals, [], 'supposition must not generate proposals');

  // 3c. Quoted text attributed to someone else
  const quoteRes = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'My manager said "I like working late at night".',
      history: [],
      allowExternalAI: true,
    }),
  });
  const quoteJson = await quoteRes.json();
  assert.deepEqual(quoteJson.proposals, [], 'quoted statements by others must not generate proposals');

  // 4. Duplicate Handling: Does not propose facts that already exist in approved memories
  const dupRes = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'I work in Pune as an intern at Google.',
      history: [],
      allowExternalAI: true,
    }),
  });
  const dupJson = await dupRes.json();
  assert.deepEqual(dupJson.proposals, [], 'existing approved memories must not be proposed again');

  // 5. Consent-Disabled Behavior: Runs local fallback extractor with zero external AI calls
  capturedRequests = [];
  const noConsentRes = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Every morning I wake up at 6 AM to meditate.',
      history: [],
      allowExternalAI: false,
    }),
  });
  assert.equal(noConsentRes.status, 200);
  const noConsentJson = await noConsentRes.json();
  assert.equal(noConsentJson.mode, 'demo');
  assert.equal(capturedRequests.length, 0, 'must not send any request to external AI provider when consent is false');
  assert.ok(Array.isArray(noConsentJson.proposals));
  assert.equal(noConsentJson.proposals.length, 1);
  assert.match(noConsentJson.proposals[0], /Every morning I wake up at 6 AM/i);

  // 6. Approval Workflow: Approved proposal is saved via POST /api/memories and enters memory context
  const proposalToApprove = prefJson.proposals[0];
  const createRes = await fetch(`${backendUrl}/api/memories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: proposalToApprove }),
  });
  assert.equal(createRes.status, 201);
  const createdMemory = await createRes.json();
  assert.equal(createdMemory.status, 'approved');
  assert.equal(createdMemory.text, proposalToApprove);

  // 7. Verify the newly approved memory is now retrievable in subsequent chat
  capturedRequests = [];
  await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Do I prefer ebooks or physical books?',
      history: [],
      allowExternalAI: true,
    }),
  });
  assert.equal(capturedRequests.length, 1);
  const messagesContext = JSON.stringify(capturedRequests[0].body.messages);
  assert.match(messagesContext, /I prefer reading physical books rather than ebooks/);
});

test('automatic Sleep Cycle scheduler and contradiction detection work correctly', async () => {
  // 1. Verify health endpoint reports scheduledJobs: true
  const healthRes = await fetch(`${backendUrl}/api/health`);
  assert.equal(healthRes.status, 200);
  const health = await healthRes.json();
  assert.equal(health.backend, 'ok');
  assert.equal(health.scheduledJobs, true, 'Health check must report scheduledJobs: true when scheduler is active');

  // 2. Setup memories with known facts
  const data = {
    version: 1,
    messages: [],
    memories: [
      {
        id: 'mem-work-pune',
        text: 'I work in Pune as an intern at Google.',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        status: 'approved',
      },
      {
        id: 'mem-pref-dark',
        text: 'I prefer dark mode in all apps.',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        status: 'approved',
      },
    ],
    reminders: [],
    decisions: [],
    sleepRuns: [],
    theme: 'somnia',
    allowExternalAI: true,
  };
  await fetch(`${backendUrl}/api/data`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  // 3. Test incoming proposal with conflicting preference (light mode vs dark mode)
  const conflictChatRes = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'I prefer light mode in all apps now.',
      history: [],
      allowExternalAI: true,
    }),
  });
  assert.equal(conflictChatRes.status, 200);
  const conflictJson = await conflictChatRes.json();
  assert.ok(Array.isArray(conflictJson.proposals), 'proposals must be an array');
  assert.equal(conflictJson.proposals.length, 1);
  assert.ok(Array.isArray(conflictJson.conflicts), 'conflicts must be an array');
  assert.equal(conflictJson.conflicts.length, 1);
  assert.equal(conflictJson.conflicts[0].existingMemoryId, 'mem-pref-dark');
  assert.match(conflictJson.conflicts[0].reason, /Opposing preference detected/i);

  // 4. Test incoming proposal with conflicting employer and location
  const conflictWorkRes = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'I work in London as an intern at Microsoft.',
      history: [],
      allowExternalAI: true,
    }),
  });
  assert.equal(conflictWorkRes.status, 200);
  const conflictWorkJson = await conflictWorkRes.json();
  assert.ok(Array.isArray(conflictWorkJson.conflicts));
  assert.ok(conflictWorkJson.conflicts.length >= 1);
  assert.equal(conflictWorkJson.conflicts[0].existingMemoryId, 'mem-work-pune');

  // 5. Test GET /api/memories/contradictions endpoint
  // Add a conflicting memory directly to approved memories
  await fetch(`${backendUrl}/api/memories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'I prefer light theme on all devices.' }),
  });

  const getContradictionsRes = await fetch(`${backendUrl}/api/memories/contradictions`);
  assert.equal(getContradictionsRes.status, 200);
  const contradictionsData = await getContradictionsRes.json();
  assert.ok(Array.isArray(contradictionsData.contradictions));
  assert.equal(contradictionsData.contradictions.length, 1);
  assert.match(contradictionsData.contradictions[0].reason, /Opposing preference/i);

  // 6. Resolve contradiction by editing/archiving one memory
  const memoryToArchive = contradictionsData.contradictions[0].memoryB;
  const archiveRes = await fetch(`${backendUrl}/api/memories/${encodeURIComponent(memoryToArchive.id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'archived' }),
  });
  assert.equal(archiveRes.status, 200);
  const archived = await archiveRes.json();
  assert.equal(archived.status, 'archived');

  // Verify contradictions is now empty
  const afterArchiveRes = await fetch(`${backendUrl}/api/memories/contradictions`);
  const afterArchiveData = await afterArchiveRes.json();
  assert.deepEqual(afterArchiveData.contradictions, []);
});
