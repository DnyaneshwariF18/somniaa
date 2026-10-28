# Somnia

Somnia is a local-first React + TypeScript app with a small Node.js backend and SQLite database. The backend runs only on `127.0.0.1`; there are no accounts, hosted database, or automatic cloud sync. Browser local storage remains a cache and migration source.

## Run it

1. Install Node.js 22.13 or newer (the backend uses the built-in `node:sqlite` module).
2. Open a terminal in this `project` folder.
3. Run `npm install` once.
4. Run `npm run dev` to start the backend and Vite frontend together. The frontend starts only after the backend health check passes; if the backend is already running on the configured port, the launcher reuses it.
5. Open the local URL printed by Vite.

To run only one process, use `npm run dev:backend` or `npm run dev:frontend`; the frontend-only command requires the backend to already be running. `npm run dev:all` is an alias for the combined development startup. To check the project, run `npm run build`, `npm run typecheck`, and `npm run lint`.

## Backend and AI setup

- SQLite is created at `data/somnia.sqlite` on first run. Set `SOMNIA_DB_PATH` to choose another local path.
- Without provider credentials, chat explicitly runs in demo mode. Demo responses are examples, not LLM output.
- To connect an OpenAI-compatible provider, copy `.env.example` to `.env` and set `SOMNIA_AI_BASE_URL`, `SOMNIA_AI_API_KEY`, and `SOMNIA_AI_MODEL`. Never put credentials in frontend files or commit `.env`.
- External AI sharing is off by default. A user must enable it in Settings. When enabled, Somnia sends the current message, up to eight recent chat messages, and a small set of relevant approved memories and recorded decisions. Provider terms and charges may apply.
- Chat, memories, reminders, decisions, Sleep Cycle history, and theme are persisted in SQLite and mirrored to browser local storage. Existing browser-only data is imported into an empty backend on first launch.
- Sleep Cycle runs a real backend job when manually triggered and flags approved memories not updated in 180 days. It does not mutate memories, run automatically, or fabricate evaluation results.
- Settings can change the theme, export data as JSON, manage AI consent, or delete saved data.

## Important limitations and privacy

- The SQLite database and browser cache are not encrypted by Somnia. Anyone with access to this device/account may be able to read them. There is no authentication or multi-user isolation; keep the backend bound to localhost.
- Do not save highly sensitive information. Exported JSON is not encrypted.
- Reminders are records only. No notification delivery or recurring reminder scheduler is configured.
- Sleep Cycle scheduling, memory candidate extraction, proposal approval/audit workflows, and replay evaluation are not implemented. The current review is a deterministic staleness check only.
- An enabled external provider receives the limited context described above. Review its privacy and data-processing terms before opting in.

See `ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `API_SPEC.md`, `AI_MEMORY_DESIGN.md`, `SLEEP_CYCLE_DESIGN.md`, and `SECURITY_PRIVACY.md` for the current design and limitations.
