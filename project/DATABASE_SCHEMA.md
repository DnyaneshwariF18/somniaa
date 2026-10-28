# Database schema

The backend creates the SQLite database automatically at `data/somnia.sqlite`. Schema creation is in `server/index.mjs`. It is a single-user local database; there are no user IDs or account tables.

| Table | Important fields and constraints |
|---|---|
| `app_settings` | Singleton `id=1`; theme allowlist; `allow_external_ai` boolean with default false. |
| `messages` | Unique ID, role constrained to `user` or `somnia`, text. |
| `memories` | Unique ID, content, created/updated ISO timestamps, status constrained to `approved` or `archived`; index on status and update time. |
| `reminders` | Unique ID, title, details, due timestamp, optional completion timestamp, created timestamp; due-time index. |
| `decisions` | Unique ID, title, context, options, recorded reasoning, expected outcome, review date, actual outcome, lesson, and timestamps. |
| `sleep_runs` | Unique run ID and idempotency key, start timestamp, status, JSON list of stale memory IDs. |

The API validates imported record shape and uses a SQLite transaction for complete state replacement. Dates are serialized as ISO strings by the frontend. The frontend data format currently remains version 1; browser-only data is migrated to SQLite on first backend startup.

The current schema intentionally does not claim support for conversation entities, memory version history, proposal/approval audit history, notification attempts, evaluation test cases, or accounts. Those product features remain future work.
