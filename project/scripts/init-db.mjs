import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const targetDbPath = resolve(process.argv[2] ?? process.env.SOMNIA_DB_PATH ?? 'somnia.db');

console.log(`Initializing SQLite database at: ${targetDbPath}`);

mkdirSync(dirname(targetDbPath), { recursive: true });
const database = new DatabaseSync(targetDbPath);

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

const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Tables created successfully:');
for (const table of tables) {
  console.log(` - ${table.name}`);
}

const indices = database.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log('Indices created successfully:');
for (const idx of indices) {
  console.log(` - ${idx.name}`);
}

database.close();
console.log(`Database initialization complete for ${targetDbPath}`);
