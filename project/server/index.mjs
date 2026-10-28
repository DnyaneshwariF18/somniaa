import { createServer } from 'node:http';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const envPath = resolve('.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);

const port = Number(process.env.SOMNIA_PORT ?? 8787);
const databasePath = resolve(process.env.SOMNIA_DB_PATH ?? './data/somnia.sqlite');
const maxBodyBytes = 1024 * 1024;
const themes = new Set(['somnia', 'neural', 'cosmic', 'quantum']);
const roles = new Set(['user', 'somnia']);

mkdirSync(dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    theme TEXT NOT NULL CHECK (theme IN ('somnia', 'neural', 'cosmic', 'quantum')),
    allow_external_ai INTEGER NOT NULL DEFAULT 0 CHECK (allow_external_ai IN (0, 1))
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('user', 'somnia')),
    text TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('approved', 'archived'))
  );
  CREATE INDEX IF NOT EXISTS memories_status_updated ON memories(status, updated_at);
  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    details TEXT NOT NULL,
    due_at TEXT NOT NULL,
    completed_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS reminders_due_at ON reminders(due_at);
  CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    context TEXT NOT NULL,
    options TEXT NOT NULL,
    reasoning TEXT NOT NULL,
    expected_outcome TEXT NOT NULL,
    review_date TEXT NOT NULL,
    actual_outcome TEXT NOT NULL,
    lesson TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sleep_runs (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE,
    started_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
    stale_memory_ids TEXT NOT NULL
  );
`);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value) {
  return typeof value === 'string';
}

function validateUniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.id)) {
      throw new HttpError(400, `Duplicate ${label} ID "${item.id}". Refresh the app to repair local chat history, then retry.`);
    }
    ids.add(item.id);
  }
}

function validateData(value) {
  if (
    !isObject(value) ||
    value.version !== 1 ||
    !Array.isArray(value.messages) ||
    !Array.isArray(value.memories) ||
    !Array.isArray(value.reminders) ||
    !Array.isArray(value.decisions) ||
    !Array.isArray(value.sleepRuns) ||
    !themes.has(value.theme) ||
    (value.allowExternalAI !== undefined && typeof value.allowExternalAI !== 'boolean')
  ) {
    throw new HttpError(400, 'Invalid Somnia data payload.');
  }

  validateUniqueIds(value.messages, 'chat message');
  validateUniqueIds(value.memories, 'memory');
  validateUniqueIds(value.reminders, 'reminder');
  validateUniqueIds(value.decisions, 'decision');
  validateUniqueIds(value.sleepRuns, 'Sleep Cycle run');

  for (const message of value.messages) {
    if (!isObject(message) || !isText(message.id) || !roles.has(message.role) || !isText(message.text)) {
      throw new HttpError(400, 'Invalid chat message in data payload.');
    }
  }
  for (const memory of value.memories) {
    if (
      !isObject(memory) ||
      !isText(memory.id) ||
      !isText(memory.text) ||
      !isText(memory.createdAt) ||
      !isText(memory.updatedAt) ||
      !['approved', 'archived'].includes(memory.status)
    ) {
      throw new HttpError(400, 'Invalid memory in data payload.');
    }
  }
  for (const reminder of value.reminders) {
    if (
      !isObject(reminder) ||
      !isText(reminder.id) ||
      !isText(reminder.title) ||
      !isText(reminder.details) ||
      !isText(reminder.dueAt) ||
      !(reminder.completedAt === null || isText(reminder.completedAt)) ||
      !isText(reminder.createdAt)
    ) {
      throw new HttpError(400, 'Invalid reminder in data payload.');
    }
  }
  for (const decision of value.decisions) {
    if (
      !isObject(decision) ||
      ['id', 'title', 'context', 'options', 'reasoning', 'expectedOutcome', 'reviewDate',
        'actualOutcome', 'lesson', 'createdAt', 'updatedAt'].some((key) => !isText(decision[key]))
    ) {
      throw new HttpError(400, 'Invalid decision in data payload.');
    }
  }
  for (const run of value.sleepRuns) {
    if (
      !isObject(run) ||
      !isText(run.id) ||
      !isText(run.startedAt) ||
      run.status !== 'completed' ||
      !Array.isArray(run.staleMemoryIds) ||
      run.staleMemoryIds.some((id) => !isText(id))
    ) {
      throw new HttpError(400, 'Invalid Sleep Cycle run in data payload.');
    }
  }
  return value;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function mapRows(query, mapper) {
  return database.prepare(query).all().map(mapper);
}

function readData() {
  const settings = database.prepare('SELECT theme, allow_external_ai FROM app_settings WHERE id = 1').get();
  if (!settings) return null;
  return {
    version: 1,
    messages: mapRows('SELECT id, role, text FROM messages ORDER BY rowid', (row) => row),
    memories: mapRows(
      'SELECT id, text, created_at, updated_at, status FROM memories ORDER BY rowid DESC',
      (row) => ({
        id: row.id,
        text: row.text,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        status: row.status,
      }),
    ),
    reminders: mapRows(
      'SELECT id, title, details, due_at, completed_at, created_at FROM reminders ORDER BY rowid DESC',
      (row) => ({
        id: row.id,
        title: row.title,
        details: row.details,
        dueAt: row.due_at,
        completedAt: row.completed_at,
        createdAt: row.created_at,
      }),
    ),
    decisions: mapRows(
      `SELECT id, title, context, options, reasoning, expected_outcome, review_date,
        actual_outcome, lesson, created_at, updated_at FROM decisions ORDER BY rowid DESC`,
      (row) => ({
        id: row.id,
        title: row.title,
        context: row.context,
        options: row.options,
        reasoning: row.reasoning,
        expectedOutcome: row.expected_outcome,
        reviewDate: row.review_date,
        actualOutcome: row.actual_outcome,
        lesson: row.lesson,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    ),
    sleepRuns: mapRows(
      'SELECT id, started_at, status, stale_memory_ids FROM sleep_runs ORDER BY rowid DESC',
      (row) => ({
        id: row.id,
        startedAt: row.started_at,
        status: row.status,
        staleMemoryIds: JSON.parse(row.stale_memory_ids),
      }),
    ),
    theme: settings.theme,
    allowExternalAI: Boolean(settings.allow_external_ai),
  };
}

function replaceData(rawData) {
  const data = validateData(rawData);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare('DELETE FROM messages').run();
    database.prepare('DELETE FROM memories').run();
    database.prepare('DELETE FROM reminders').run();
    database.prepare('DELETE FROM decisions').run();
    database.prepare('DELETE FROM sleep_runs').run();

    const insertMessage = database.prepare('INSERT INTO messages (id, role, text) VALUES (?, ?, ?)');
    for (const item of data.messages) insertMessage.run(item.id, item.role, item.text);

    const insertMemory = database.prepare(
      'INSERT INTO memories (id, text, created_at, updated_at, status) VALUES (?, ?, ?, ?, ?)',
    );
    for (const item of data.memories) {
      insertMemory.run(item.id, item.text, item.createdAt, item.updatedAt, item.status);
    }

    const insertReminder = database.prepare(
      'INSERT INTO reminders (id, title, details, due_at, completed_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const item of data.reminders) {
      insertReminder.run(item.id, item.title, item.details, item.dueAt, item.completedAt, item.createdAt);
    }

    const insertDecision = database.prepare(
      `INSERT INTO decisions (id, title, context, options, reasoning, expected_outcome, review_date,
        actual_outcome, lesson, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const item of data.decisions) {
      insertDecision.run(
        item.id, item.title, item.context, item.options, item.reasoning, item.expectedOutcome,
        item.reviewDate, item.actualOutcome, item.lesson, item.createdAt, item.updatedAt,
      );
    }

    const insertRun = database.prepare(
      `INSERT INTO sleep_runs (id, idempotency_key, started_at, status, stale_memory_ids)
        VALUES (?, ?, ?, ?, ?)`,
    );
    for (const [index, item] of data.sleepRuns.entries()) {
      insertRun.run(item.id, `import-${item.id}-${index}`, item.startedAt, item.status, JSON.stringify(item.staleMemoryIds));
    }

    database.prepare(
      `INSERT INTO app_settings (id, theme, allow_external_ai) VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET theme = excluded.theme, allow_external_ai = excluded.allow_external_ai`,
    ).run(data.theme, data.allowExternalAI ? 1 : 0);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function tokenize(value) {
  return new Set(value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
}

function relevantRecords(table, query, columns, limit, where = '') {
  const terms = tokenize(query);
  if (terms.size === 0) return [];
  const rows = database.prepare(
    `SELECT ${columns.join(', ')} FROM ${table}${where ? ` WHERE ${where}` : ''}`,
  ).all();
  return rows
    .map((row) => {
      const content = columns.map((column) => row[column]).join(' ');
      const tokens = tokenize(content);
      const score = [...terms].filter((term) => tokens.has(term)).length;
      return { row, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ row }) => row);
}

function llmConfiguration() {
  const apiKey = process.env.SOMNIA_AI_API_KEY?.trim();
  const model = process.env.SOMNIA_AI_MODEL?.trim();
  const configured = Boolean(apiKey && model);
  return {
    configured,
    apiKey,
    model,
    baseUrl: (process.env.SOMNIA_AI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, ''),
  };
}

async function handleChat(body) {
  if (
    !isObject(body) ||
    !isText(body.message) ||
    body.message.trim().length === 0 ||
    body.message.length > 8000 ||
    typeof body.allowExternalAI !== 'boolean'
  ) {
    throw new HttpError(400, 'Message must contain 1 to 8000 characters.');
  }

  const settings = database.prepare('SELECT allow_external_ai FROM app_settings WHERE id = 1').get();
  const config = llmConfiguration();
  if (!settings?.allow_external_ai || !body.allowExternalAI || !config.configured) return { mode: 'demo' };

  const memories = relevantRecords('memories', body.message, ['text'], 5, "status = 'approved'")
    .map((item) => item.text);
  const decisions = relevantRecords(
    'decisions',
    body.message,
    ['title', 'context', 'reasoning', 'actual_outcome', 'lesson'],
    3,
  ).map((item) => ({
    title: item.title,
    recordedContext: item.context,
    recordedReasoning: item.reasoning,
  }));
  const history = Array.isArray(body.history)
    ? body.history.slice(-8).filter(
        (item) => isObject(item) && roles.has(item.role) && isText(item.text) && item.text.length <= 8000,
      )
    : [];
  const messages = [
    {
      role: 'system',
      content: [
        'You are Somnia, a personal assistant. Be clear about uncertainty and never claim an inference is a verified fact.',
        'The supplied memories are user-approved records, not proof beyond their recorded content.',
        'Decision entries contain only recorded rationale; do not invent why a user made a past decision.',
        'Do not claim to have created or scheduled reminders, changed memory, or completed actions.',
        memories.length ? `Relevant approved memories:\n${memories.map((item) => `- ${item}`).join('\n')}` : '',
        decisions.length
          ? `Relevant recorded decisions (quote or summarize only what is present):\n${JSON.stringify(decisions)}`
          : '',
      ].filter(Boolean).join('\n\n'),
    },
    ...history.map((item) => ({
      role: item.role === 'somnia' ? 'assistant' : 'user',
      content: item.text,
    })),
  ];
  if (history.at(-1)?.role !== 'user' || history.at(-1)?.text !== body.message) {
    messages.push({ role: 'user', content: body.message });
  }

  let response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    console.error('AI provider request failed.');
    throw new HttpError(502, 'AI provider request failed. Check connectivity and try again.');
  }

  if (!response.ok) {
    console.error(`AI provider returned HTTP ${response.status}.`);
    throw new HttpError(502, `AI provider returned HTTP ${response.status}. Check the server configuration and try again.`);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new HttpError(502, 'AI provider returned an invalid response.');
  }
  const text = result?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new HttpError(502, 'AI provider response did not contain a message.');
  }
  return { mode: 'ai', text: text.trim() };
}

async function readJson(request) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBodyBytes) throw new HttpError(413, 'Request body is too large.');
    chunks.push(chunk);
  }
  if (bytes === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
}

function respond(response, status, value) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

const server = createServer(async (request, response) => {
  try {
    const host = request.headers.host ?? '';
    const origin = request.headers.origin;
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
      throw new HttpError(403, 'Somnia backend accepts local connections only.');
    }
    if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      throw new HttpError(403, 'Cross-origin requests are not allowed.');
    }
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/api/health' && request.method === 'GET') {
      const config = llmConfiguration();
      const settings = database.prepare('SELECT allow_external_ai FROM app_settings WHERE id = 1').get();
      const enabled = Boolean(settings?.allow_external_ai);
      return respond(response, 200, {
        backend: 'ok',
        storage: 'sqlite',
        llm: {
          configured: config.configured,
          enabled,
          model: config.configured ? config.model : null,
          mode: config.configured && enabled ? 'ai' : 'demo',
        },
        scheduledJobs: false,
      });
    }

    if (url.pathname === '/api/data' && request.method === 'GET') {
      return respond(response, 200, { data: readData() });
    }
    if (url.pathname === '/api/data' && request.method === 'PUT') {
      replaceData(await readJson(request));
      return respond(response, 200, { ok: true });
    }
    if (url.pathname === '/api/data' && request.method === 'DELETE') {
      database.exec('BEGIN IMMEDIATE');
      try {
        database.exec('DELETE FROM messages; DELETE FROM memories; DELETE FROM reminders; DELETE FROM decisions; DELETE FROM sleep_runs; DELETE FROM app_settings;');
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
      return respond(response, 200, { ok: true });
    }
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return respond(response, 200, await handleChat(await readJson(request)));
    }
    if (url.pathname === '/api/sleep-cycle' && request.method === 'POST') {
      const key = request.headers['idempotency-key'];
      if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(key)) {
        throw new HttpError(400, 'A valid Idempotency-Key header is required.');
      }

      const existing = database.prepare('SELECT id FROM sleep_runs WHERE idempotency_key = ?').get(key);
      if (!existing) {
        const startedAt = new Date().toISOString();
        const staleMemoryIds = database.prepare(
          "SELECT id FROM memories WHERE status = 'approved' AND updated_at < ? ORDER BY updated_at",
        ).all(new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()).map((row) => row.id);
        const id = crypto.randomUUID();
        database.prepare(
          `INSERT INTO sleep_runs (id, idempotency_key, started_at, status, stale_memory_ids)
            VALUES (?, ?, ?, 'completed', ?)`,
        ).run(id, key, startedAt, JSON.stringify(staleMemoryIds));
      }
      return respond(response, 200, { data: readData() });
    }
    return respond(response, 404, { error: 'API route not found.' });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error('Somnia backend error:', error);
    return respond(response, status, {
      error: status === 500 ? 'Somnia backend could not complete the request.' : error.message,
    });
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Somnia could not bind to 127.0.0.1:${port} because the port is already in use. ` +
      'If another Somnia backend is running, npm run dev will reuse it. Otherwise set SOMNIA_PORT to a free port.',
    );
  } else {
    console.error('Somnia backend server failed:', error);
  }
  database.close();
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Somnia backend listening at http://127.0.0.1:${port}`);
  console.log(`SQLite database: ${databasePath}`);
  const config = llmConfiguration();
  console.log(`LLM provider: ${config.configured ? `configured (${config.model})` : 'not configured; demo mode'}`);
});

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
