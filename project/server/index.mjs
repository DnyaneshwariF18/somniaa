import { createServer } from 'node:http';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const envPath = resolve('.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);

const port = Number(process.env.SOMNIA_PORT ?? 8787);
const defaultDb = existsSync('somnia.db')
  ? 'somnia.db'
  : existsSync('./data/somnia.db')
    ? './data/somnia.db'
    : existsSync('./data/somnia.sqlite')
      ? './data/somnia.sqlite'
      : 'somnia.db';
const databasePath = resolve(process.env.SOMNIA_DB_PATH ?? defaultDb);
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

function mapMemoryRow(row) {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
  };
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

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'all', 'am', 'an', 'and', 'any',
  'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between',
  'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'doing', 'down',
  'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having',
  'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i',
  'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more',
  'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their',
  'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
  'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what',
  'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would',
  'you', 'your', 'yours', 'yourself', 'yourselves',
]);

const SYNONYMS = {
  internship: ['intern', 'job', 'work', 'workplace', 'company', 'role'],
  intern: ['internship', 'job', 'work', 'role'],
  job: ['work', 'internship', 'intern', 'career', 'employment', 'position', 'company'],
  work: ['job', 'internship', 'intern', 'career', 'employment', 'office', 'workplace', 'company'],
  workplace: ['work', 'office', 'job', 'company', 'internship'],
  company: ['employer', 'workplace', 'office', 'firm', 'organization', 'work'],
  employer: ['company', 'workplace', 'work', 'firm'],
  location: ['city', 'place', 'where', 'town', 'address', 'office'],
  city: ['location', 'place', 'town', 'where'],
  place: ['location', 'city', 'town'],
  study: ['learning', 'notes', 'revision', 'preference', 'routine', 'habit'],
  routine: ['habit', 'preference', 'schedule', 'routine'],
  preference: ['routine', 'habit', 'choice', 'style', 'preference'],
};

function stem(word) {
  if (typeof word !== 'string' || word.length <= 3) return word;
  let s = word.toLowerCase();
  // Strip common inflectional suffixes
  s = s.replace(/(?:ing|edly|ed|es|s)$/i, '');
  // Strip common derivational suffixes
  s = s.replace(/(?:ship|ment|tions?|sions?|ences?|ances?|ness|ables?|ibles?|al|ive|ity|ous)$/i, '');
  // Normalize double consonant endings (e.g. runn -> run)
  s = s.replace(/(.)\1$/, '$1');
  // Normalize terminal 'i' to 'y' (e.g. studi -> study, citi -> city)
  if (s.endsWith('i') && s.length >= 3) s = s.slice(0, -1) + 'y';
  return s.length >= 2 ? s : word;
}

function extractTerms(text) {
  if (typeof text !== 'string') return { tokens: new Set(), stems: new Set(), synonyms: new Set() };
  const rawWords = text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  const contentWords = rawWords.filter((w) => !STOP_WORDS.has(w));
  const effectiveWords = contentWords.length > 0 ? contentWords : rawWords;
  const tokens = new Set(effectiveWords);
  const stems = new Set();
  const synonyms = new Set();

  for (const w of effectiveWords) {
    const s = stem(w);
    if (s.length >= 2) stems.add(s);

    const related = [
      ...(SYNONYMS[w] ?? []),
      ...(SYNONYMS[s] ?? []),
    ];
    for (const item of related) {
      synonyms.add(item);
      const itemStem = stem(item);
      if (itemStem.length >= 2) stems.add(itemStem);
    }
  }

  return { tokens, stems, synonyms };
}

function scoreRecord(queryTerms, recordTerms) {
  if (queryTerms.tokens.size === 0 || recordTerms.tokens.size === 0) return 0;
  let score = 0;

  for (const qToken of queryTerms.tokens) {
    // Tier 1: Exact token match
    if (recordTerms.tokens.has(qToken)) {
      score += 4;
      continue;
    }
    // Tier 2: Stem match (e.g. internship -> intern, preferences -> prefer)
    const qStem = stem(qToken);
    if (recordTerms.stems.has(qStem)) {
      score += 3;
      continue;
    }
    // Tier 3: Prefix / substring match (minimum 4 chars)
    if (qToken.length >= 4) {
      let prefixMatch = false;
      for (const rToken of recordTerms.tokens) {
        if (rToken.length >= 4 && (rToken.startsWith(qToken) || qToken.startsWith(rToken))) {
          score += 2;
          prefixMatch = true;
          break;
        }
      }
      if (prefixMatch) continue;
    }
    if (qStem.length >= 4) {
      let stemPrefixMatch = false;
      for (const rStem of recordTerms.stems) {
        if (rStem.length >= 4 && (rStem.startsWith(qStem) || qStem.startsWith(rStem))) {
          score += 2;
          stemPrefixMatch = true;
          break;
        }
      }
      if (stemPrefixMatch) continue;
    }
    // Tier 4: Concept synonym match
    if (queryTerms.synonyms && queryTerms.synonyms.size > 0) {
      for (const syn of queryTerms.synonyms) {
        if (recordTerms.tokens.has(syn) || recordTerms.stems.has(syn)) {
          score += 1;
          break;
        }
      }
    }
  }

  return score;
}

function tokenize(value) {
  return new Set(value.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []);
}

function relevantRecords(table, query, columns, limit, where = '', history = []) {
  const queryTerms = extractTerms(query);
  const recentTexts = Array.isArray(history)
    ? history
        .slice(-4)
        .filter((item) => isObject(item) && (item.role === 'user' || item.role === 'somnia') && isText(item.text))
        .map((item) => item.text)
        .filter((text) => text.trim().toLowerCase() !== query.trim().toLowerCase())
    : [];
  const historyTerms = recentTexts.length > 0 ? extractTerms(recentTexts.join(' ')) : null;

  if (queryTerms.tokens.size === 0 && (!historyTerms || historyTerms.tokens.size === 0)) return [];

  const rows = database.prepare(
    `SELECT ${columns.join(', ')} FROM ${table}${where ? ` WHERE ${where}` : ''}`,
  ).all();

  return rows
    .map((row) => {
      const content = columns.map((column) => row[column]).join(' ');
      const recordTerms = extractTerms(content);
      const queryScore = scoreRecord(queryTerms, recordTerms);
      const historyScore = historyTerms ? scoreRecord(historyTerms, recordTerms) : 0;
      const totalScore = queryScore * 3 + historyScore;
      return { row, score: totalScore };
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

const FACT_PATTERNS = [
  // Preferences
  /\b(?:i|my)\s+(?:strongly\s+|always\s+|personally\s+)?(?:prefer|preference\s+is)\b/i,
  /\bi\s+(?:really\s+|always\s+)?(?:like|love|dislike|hate)\s+(?:to\s+)?[a-z]/i,
  /\bmy\s+favorite\s+[a-z0-9_-]+\s+is\b/i,
  /\bi\s+don'?t\s+like\s+[a-z]/i,

  // Life situation, employment, location, education
  /\bi\s+(?:currently\s+)?(?:work|intern)\s+(?:at|in|for|as)\b/i,
  /\bi\s+am\s+(?:an?\s+)?(?:intern|engineer|developer|student|designer|manager|researcher)\s+(?:at|in|for)\b/i,
  /\bi\s+(?:currently\s+)?live\s+in\b/i,
  /\bi\s+(?:just\s+)?(?:moved|relocated)\s+to\b/i,
  /\bi\s+(?:study|am\s+studying)\s+[a-z]/i,

  // Routines & habits
  /\bevery\s+(?:day|morning|evening|night|afternoon|weekend|weekday)\s+i\b/i,
  /\bmy\s+(?:morning|evening|night|sleep|daily|work)\s+routine\s+is\b/i,
  /\bi\s+(?:usually|always|typically)\s+(?:wake\s+up|sleep|exercise|meditate|read|work|run|go|eat|drink)\b/i,

  // Goals
  /\bmy\s+goal\s+is\s+to\b/i,
  /\bi\s+am\s+(?:aiming|planning|hoping|training)\s+to\b/i,
  /\bi\s+want\s+to\s+learn\s+[a-z]/i,
];

const DISQUALIFY_PATTERNS = [
  /\bwhat\s+if\b/i,
  /\bif\s+i\b/i,
  /\bsuppose\b/i,
  /\bimagining\b/i,
  /\bimagine\b/i,
  /\bhypothetically\b/i,
  /\bfor\s+example\b/i,
  /\bmaybe\s+i\s+should\b/i,
  /\bcould\s+i\b/i,
  /\bwould\s+it\s+be\b/i,
  /\bdo\s+i\b/i,
  /\bwhy\s+do\s+i\b/i,
  /\bwhere\s+is\b/i,
  /\bhow\s+do\s+i\b/i,
  /\?$/,
];

function isDuplicateProposal(proposal, existingMemories) {
  const propTerms = extractTerms(proposal).tokens;
  if (propTerms.size === 0) return true;

  for (const memory of existingMemories) {
    const memTerms = extractTerms(memory).tokens;
    let matchCount = 0;
    for (const term of propTerms) {
      if (memTerms.has(term)) matchCount++;
    }
    const overlapRatio = matchCount / Math.max(propTerms.size, 1);
    if (overlapRatio >= 0.7) {
      return true;
    }
  }
  return false;
}

function extractMemoryProposals(message, existingApprovedMemories = []) {
  if (typeof message !== 'string' || message.trim().length === 0) return [];

  // Split into sentences using punctuation boundaries (. ! ? \n)
  const rawSentences = message
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8 && s.length <= 400);

  const proposals = [];

  for (const raw of rawSentences) {
    // Check if the whole sentence or candidate fact is attributed to someone else
    if (/\b(?:said|says|told\s+me|wrote|quoted|claimed)\s+["']/i.test(raw)) {
      continue;
    }

    // Strip inline quotation blocks to prevent proposing quoted text that the user didn't endorse
    const withoutQuotes = raw.replace(/["'][^"']+["']/g, '').trim();

    // Must not match any disqualifying patterns (hypotheticals, questions, speculations)
    const isDisqualified = DISQUALIFY_PATTERNS.some((pattern) => pattern.test(withoutQuotes) || pattern.test(raw));
    if (isDisqualified) continue;

    // Must match at least one candidate fact pattern
    const isFact = FACT_PATTERNS.some((pattern) => pattern.test(withoutQuotes));
    if (!isFact) continue;

    // Normalize: capitalize first letter, ensure trailing period, clean spaces
    let clean = raw.replace(/\s+/g, ' ').trim();
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    if (!/[.!?]$/.test(clean)) clean += '.';

    // Check for duplicates against existing approved memories
    // If a statement contradicts an existing memory, it represents a conflicting update rather than a duplicate
    const contradictsAny = existingApprovedMemories.some((mem) => findContradiction(clean, mem));
    if (!contradictsAny && isDuplicateProposal(clean, existingApprovedMemories)) {
      continue;
    }

    // Check for duplicates in current proposals list
    if (isDuplicateProposal(clean, proposals)) {
      continue;
    }

    proposals.push(clean);
    if (proposals.length >= 2) break;
  }

  return proposals;
}

function findContradiction(textA, textB) {
  if (typeof textA !== 'string' || typeof textB !== 'string') return null;
  const a = textA.toLowerCase();
  const b = textB.toLowerCase();

  // 1. Mutually exclusive preference pairs (e.g. dark mode vs light mode, books vs ebooks, tea vs coffee)
  const exclusivePairs = [
    [['dark mode', 'dark theme'], ['light mode', 'light theme']],
    [['physical books', 'paper books'], ['ebooks', 'e-books', 'kindle']],
    [['coffee'], ['tea']],
    [['vegetarian', 'vegan'], ['eat meat', 'carnivore', 'love steak', 'eats meat']],
    [['mac', 'macos'], ['windows', 'linux']],
    [['ios', 'iphone'], ['android']],
  ];

  for (const [group1, group2] of exclusivePairs) {
    const aHasG1 = group1.some((k) => a.includes(k));
    const aHasG2 = group2.some((k) => a.includes(k));
    const bHasG1 = group1.some((k) => b.includes(k));
    const bHasG2 = group2.some((k) => b.includes(k));

    if ((aHasG1 && bHasG2) || (aHasG2 && bHasG1)) {
      const prefMarkers = ['prefer', 'like', 'love', 'use', 'always', 'favorite', 'favourite', 'work on'];
      const aPref = prefMarkers.some((m) => a.includes(m)) || aHasG1 || aHasG2;
      const bPref = prefMarkers.some((m) => b.includes(m)) || bHasG1 || bHasG2;
      if (aPref && bPref) {
        return {
          contradicts: true,
          reason: `Opposing preference detected: "${group1[0]}" vs "${group2[0]}".`,
        };
      }
    }
  }

  // 2. Conflicting employer: "work at/for X" or "intern at/for X"
  const employerRegex = /\b(?:work|working|intern|interning|employed)\s+(?:at|for)\s+([A-Za-z0-9_-]+)/i;
  const matchEmpA = employerRegex.exec(textA);
  const matchEmpB = employerRegex.exec(textB);
  if (matchEmpA && matchEmpB) {
    const empA = matchEmpA[1].trim().toLowerCase();
    const empB = matchEmpB[1].trim().toLowerCase();
    if (empA !== empB && empA.length > 1 && empB.length > 1) {
      return {
        contradicts: true,
        reason: `Conflicting employer: "${matchEmpA[1]}" vs "${matchEmpB[1]}".`,
      };
    }
  }

  // 3. Conflicting location: "live in X" / "work in X" / "stay in X" / "based in X"
  const locationRegex = /\b(?:live|living|reside|residing|stay|staying|based|work|working|intern|interning)\s+in\s+([A-Za-z]+)/i;
  const matchLocA = locationRegex.exec(textA);
  const matchLocB = locationRegex.exec(textB);
  if (matchLocA && matchLocB) {
    const locA = matchLocA[1].trim().toLowerCase();
    const locB = matchLocB[1].trim().toLowerCase();
    if (locA !== locB && locA.length > 2 && locB.length > 2) {
      return {
        contradicts: true,
        reason: `Conflicting location: "${matchLocA[1]}" vs "${matchLocB[1]}".`,
      };
    }
  }

  // 4. Polarity conflict on same subject: like/love X vs dislike/hate/avoid X
  const positiveMarker = /\b(?:prefer|love|enjoy|like|always)\s+([A-Za-z]+)/i;
  const negativeMarker = /\b(?:dislike|hate|avoid|never|cannot\s+stand|can't\s+stand|do\s+not\s+like|don't\s+like)\s+([A-Za-z]+)/i;

  const posA = positiveMarker.exec(textA);
  const negB = negativeMarker.exec(textB);
  if (posA && negB && posA[1].toLowerCase() === negB[1].toLowerCase()) {
    return {
      contradicts: true,
      reason: `Opposing attitude towards "${posA[1]}": preference vs dislike.`,
    };
  }

  const negA = negativeMarker.exec(textA);
  const posB = positiveMarker.exec(textB);
  if (negA && posB && negA[1].toLowerCase() === posB[1].toLowerCase()) {
    return {
      contradicts: true,
      reason: `Opposing attitude towards "${negA[1]}": dislike vs preference.`,
    };
  }

  return null;
}

function findMemoryContradictions(memories) {
  const contradictions = [];
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const conflict = findContradiction(memories[i].text, memories[j].text);
      if (conflict) {
        contradictions.push({
          memoryA: memories[i],
          memoryB: memories[j],
          reason: conflict.reason,
        });
      }
    }
  }
  return contradictions;
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

  const approvedRows = database.prepare("SELECT id, text, created_at, updated_at, status FROM memories WHERE status = 'approved'").all();
  const existingApprovedMemories = approvedRows.map((r) => r.text);
  const proposals = extractMemoryProposals(body.message, existingApprovedMemories);

  const conflicts = [];
  for (const prop of proposals) {
    for (const memRow of approvedRows) {
      const conflict = findContradiction(prop, memRow.text);
      if (conflict) {
        conflicts.push({
          proposal: prop,
          existingMemoryId: memRow.id,
          existingMemory: memRow.text,
          reason: conflict.reason,
        });
      }
    }
  }

  const settings = database.prepare('SELECT allow_external_ai FROM app_settings WHERE id = 1').get();
  const config = llmConfiguration();
  if (!settings?.allow_external_ai || !body.allowExternalAI || !config.configured) {
    return { mode: 'demo', proposals, conflicts };
  }

  const history = Array.isArray(body.history)
    ? body.history.slice(-8).filter(
        (item) => isObject(item) && roles.has(item.role) && isText(item.text) && item.text.length <= 8000,
      )
    : [];

  const memories = relevantRecords('memories', body.message, ['text'], 5, "status = 'approved'", history)
    .map((item) => item.text);
  const decisions = relevantRecords(
    'decisions',
    body.message,
    ['title', 'context', 'reasoning', 'actual_outcome', 'lesson'],
    3,
    '',
    history,
  ).map((item) => ({
    title: item.title,
    recordedContext: item.context,
    recordedReasoning: item.reasoning,
  }));
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
  return { mode: 'ai', text: text.trim(), proposals, conflicts };
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
        scheduledJobs: scheduledJobsActive,
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
    // POST /api/memories — create a new memory
    if (url.pathname === '/api/memories' && request.method === 'POST') {
      const body = await readJson(request);
      if (!isText(body.text) || body.text.trim().length === 0 || body.text.length > 8000) {
        throw new HttpError(400, 'Memory text must be a non-empty string of up to 8000 characters.');
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      database.prepare(
        'INSERT INTO memories (id, text, created_at, updated_at, status) VALUES (?, ?, ?, ?, ?)',
      ).run(id, body.text.trim(), now, now, 'approved');
      const row = database.prepare(
        'SELECT id, text, created_at, updated_at, status FROM memories WHERE id = ?',
      ).get(id);
      return respond(response, 201, mapMemoryRow(row));
    }

    // GET /api/memories — list all memories
    if (url.pathname === '/api/memories' && request.method === 'GET') {
      const rows = database.prepare(
        'SELECT id, text, created_at, updated_at, status FROM memories ORDER BY rowid DESC',
      ).all();
      return respond(response, 200, { memories: rows.map(mapMemoryRow) });
    }

    // GET /api/memories/contradictions — list contradictions among approved memories
    if (url.pathname === '/api/memories/contradictions' && request.method === 'GET') {
      const rows = database.prepare(
        "SELECT id, text, created_at, updated_at, status FROM memories WHERE status = 'approved' ORDER BY rowid DESC",
      ).all();
      return respond(response, 200, { contradictions: findMemoryContradictions(rows.map(mapMemoryRow)) });
    }

    // Routes that operate on a specific memory ID
    const approveMatch = /^\/api\/memories\/([^/]+)\/approve$/.exec(url.pathname);
    const memoryMatch = /^\/api\/memories\/([^/]+)$/.exec(url.pathname);

    // PATCH /api/memories/:id/approve — set status to approved
    if (approveMatch && request.method === 'PATCH') {
      const id = decodeURIComponent(approveMatch[1]);
      const now = new Date().toISOString();
      const result = database.prepare(
        "UPDATE memories SET status = 'approved', updated_at = ? WHERE id = ?",
      ).run(now, id);
      if (result.changes === 0) throw new HttpError(404, 'Memory not found.');
      const row = database.prepare(
        'SELECT id, text, created_at, updated_at, status FROM memories WHERE id = ?',
      ).get(id);
      return respond(response, 200, mapMemoryRow(row));
    }

    if (memoryMatch) {
      const id = decodeURIComponent(memoryMatch[1]);

      // GET /api/memories/:id — retrieve a single memory
      if (request.method === 'GET') {
        const row = database.prepare(
          'SELECT id, text, created_at, updated_at, status FROM memories WHERE id = ?',
        ).get(id);
        if (!row) throw new HttpError(404, 'Memory not found.');
        return respond(response, 200, mapMemoryRow(row));
      }

      // PATCH /api/memories/:id — edit text and/or status
      if (request.method === 'PATCH') {
        const body = await readJson(request);
        if (body.text !== undefined && (!isText(body.text) || body.text.trim().length === 0 || body.text.length > 8000)) {
          throw new HttpError(400, 'Memory text must be a non-empty string of up to 8000 characters.');
        }
        if (body.status !== undefined && !['approved', 'archived'].includes(body.status)) {
          throw new HttpError(400, 'Memory status must be "approved" or "archived".');
        }
        if (body.text === undefined && body.status === undefined) {
          throw new HttpError(400, 'Provide at least one of text or status to update.');
        }
        const existing = database.prepare(
          'SELECT id, text, status FROM memories WHERE id = ?',
        ).get(id);
        if (!existing) throw new HttpError(404, 'Memory not found.');
        const newText = body.text !== undefined ? body.text.trim() : existing.text;
        const newStatus = body.status !== undefined ? body.status : existing.status;
        const now = new Date().toISOString();
        database.prepare(
          'UPDATE memories SET text = ?, status = ?, updated_at = ? WHERE id = ?',
        ).run(newText, newStatus, now, id);
        const row = database.prepare(
          'SELECT id, text, created_at, updated_at, status FROM memories WHERE id = ?',
        ).get(id);
        return respond(response, 200, mapMemoryRow(row));
      }

      // DELETE /api/memories/:id — delete a memory
      if (request.method === 'DELETE') {
        const result = database.prepare('DELETE FROM memories WHERE id = ?').run(id);
        if (result.changes === 0) throw new HttpError(404, 'Memory not found.');
        return respond(response, 200, { ok: true });
      }
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

let schedulerTimer = null;
let scheduledJobsActive = false;

function runAutomaticSleepCycleReview() {
  try {
    const latestRun = database.prepare('SELECT started_at FROM sleep_runs ORDER BY started_at DESC LIMIT 1').get();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    if (!latestRun || latestRun.started_at < twentyFourHoursAgo) {
      const now = new Date();
      const startedAt = now.toISOString();
      const key = `auto-sleep-cycle-${startedAt.slice(0, 10)}`;
      const existing = database.prepare('SELECT id FROM sleep_runs WHERE idempotency_key = ?').get(key);
      if (!existing) {
        const staleMemoryIds = database.prepare(
          "SELECT id FROM memories WHERE status = 'approved' AND updated_at < ? ORDER BY updated_at",
        ).all(new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()).map((row) => row.id);
        const id = crypto.randomUUID();
        database.prepare(
          `INSERT INTO sleep_runs (id, idempotency_key, started_at, status, stale_memory_ids)
            VALUES (?, ?, ?, 'completed', ?)`,
        ).run(id, key, startedAt, JSON.stringify(staleMemoryIds));
      }
    }
  } catch (err) {
    console.error('Automated Sleep Cycle run encountered an issue:', err);
  }
}

function startSleepCycleScheduler() {
  scheduledJobsActive = true;
  runAutomaticSleepCycleReview();
  schedulerTimer = setInterval(runAutomaticSleepCycleReview, 60 * 60 * 1000);
  schedulerTimer.unref();
}

function stopSleepCycleScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  scheduledJobsActive = false;
}

startSleepCycleScheduler();

server.listen(port, '127.0.0.1', () => {
  console.log(`Somnia backend listening at http://127.0.0.1:${port}`);
  console.log(`SQLite database: ${databasePath}`);
  const config = llmConfiguration();
  console.log(`LLM provider: ${config.configured ? `configured (${config.model})` : 'not configured; demo mode'}`);
  console.log('Automated Sleep Cycle scheduler: active');
});

function shutdown() {
  stopSleepCycleScheduler();
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
