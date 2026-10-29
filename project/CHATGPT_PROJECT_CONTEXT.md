# Somnia — project context for ChatGPT

Copy this document into a new ChatGPT conversation when you want help continuing work on Somnia. It describes the current implementation; use the repository itself as the source of truth if code and this summary ever differ.

## Project overview

Somnia is a local-first personal reflection and planning app. It gives one user a dashboard, chat assistant, user-managed memories, reminders, a decision journal, and a manual Sleep Cycle review. The UI is built with React and TypeScript. A small Node.js backend stores app data in a local SQLite database. The backend binds to loopback (`127.0.0.1`); this is a single-user local MVP, not a hosted or multi-user service.

The canonical app folder is `project/` in this repository. There is also a separate `project - Copy/` directory containing an older, frontend-only snapshot; do not assume it is the active app or make changes there unless specifically asked.

## Technology and how to run it

- Node.js 22.13+ (the backend uses the built-in `node:sqlite` module)
- React 18, TypeScript, Vite 7, Tailwind CSS, Lucide icons
- Node's built-in HTTP server and SQLite; no third-party backend framework
- Supabase is listed as a frontend dependency, but the current app's persistence is local SQLite plus browser local storage; there is no configured hosted database or account system.

From a terminal in `project/`:

```bash
npm install
npm run dev
```

`npm run dev` starts/reuses the backend and starts Vite after checking backend health. The frontend is served by Vite and proxies `/api` to the local backend (port 8787 by default).

Other useful commands:

```bash
npm run dev:frontend
npm run dev:backend
npm run dev:all
npm run build
npm run typecheck
npm run lint
npm run test:backend
npm run preview
```

`dev:frontend` requires a backend already running. Tests use Node's built-in test runner.

Optional AI configuration is server-side. Copy `.env.example` to `.env` and set `SOMNIA_AI_BASE_URL`, `SOMNIA_AI_API_KEY`, and `SOMNIA_AI_MODEL`. The API key must never be put in frontend code or committed. `SOMNIA_PORT` changes the backend port; `SOMNIA_DB_PATH` changes the database path.

## Current app screens and behavior

Navigation is defined in `src/navigation.ts`; the UI is assembled in `src/App.tsx`.

- **Dashboard:** greeting and local activity summary, with links to the main features.
- **Chat:** saved conversation, prompt suggestions, new-chat action, and visible response mode. Without an enabled/configured provider, the UI labels replies as illustrative demo responses. Demo replies are keyword-based canned text from `src/chatResponses.ts`, not model output.
- **Memories:** manually add, search, edit, and delete user-provided memories. They are never automatically extracted from chat.
- **Reminders:** create, edit, filter by upcoming/completed, complete/reopen, and delete reminders. They are records only; there are no notifications or recurring scheduler.
- **Decision Journal:** record a decision, context, options, reasoning, expected outcome, and optional review date; record actual outcome and lesson later.
- **Sleep Cycle:** manually trigger a backend review. It flags approved memories whose `updatedAt` is more than 180 days old and saves a run. It is deterministic, does not use AI, does not modify memories, and is not scheduled.
- **Morning Report:** displays the latest real Sleep Cycle run and the memories it flagged. It does not generate proposals, summaries, or evaluation scores.
- **Settings & Privacy:** select one of four themes (`somnia`, `neural`, `cosmic`, `quantum`), enable/disable external AI sharing, export data as plain JSON, or delete app data after confirmation.

## Architecture and data flow

1. `src/main.tsx` mounts the React app; `src/App.tsx` selects screens and manages top-level navigation and API status.
2. `src/useLocalData.ts` loads and subscribes to browser local storage, syncs to `GET /api/data`, and queues updates to the backend. The browser cache remains available if the backend cannot be reached; errors are displayed in the UI.
3. `src/localData.ts` defines the version-1 app data types and validates/reads/writes the browser cache. `src/api.ts` wraps frontend requests to the backend.
4. `server/index.mjs` validates requests, creates SQLite tables, serves the API, persists the single local user's data, handles chat requests, and runs Sleep Cycle reviews.
5. On first backend initialization, browser-only data can be imported if the SQLite database is empty. Once initialized, backend data is the source of truth and refreshes the browser cache.
6. External chat is attempted only when a provider is configured, persisted user consent is enabled, and the request also carries current consent. Otherwise the server selects demo mode and does not call the provider.
7. With external AI enabled, the server sends the current message, up to eight recent chat messages, up to five text-matched approved memories, and up to three text-matched decisions. Archived memories are excluded. API credentials remain on the backend.

The application data shape is version 1 and includes messages, memories, reminders, decisions, Sleep Cycle runs, theme, and `allowExternalAI`. SQLite tables are created by `server/index.mjs`; the schema is summarized in `DATABASE_SCHEMA.md`.

## Backend API

The backend listens on `127.0.0.1:8787` by default. JSON request bodies are limited to 1 MiB. It checks Host and Origin values to accept local connections only.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Backend/storage status, AI configuration and mode, scheduler status |
| `GET` | `/api/data` | Read all app data (`data` is `null` before initialization) |
| `PUT` | `/api/data` | Validate and transactionally replace the full app data set |
| `DELETE` | `/api/data` | Delete local app data |
| `POST` | `/api/chat` | Return demo mode or call the configured OpenAI-compatible chat-completions provider |
| `POST` | `/api/sleep-cycle` | Run an idempotent 180-day approved-memory staleness review; requires `Idempotency-Key` |
| `POST` | `/api/memories` | Create a memory |
| `GET` | `/api/memories` | List memories |
| `GET` | `/api/memories/:id` | Read one memory |
| `PATCH` | `/api/memories/:id` | Edit memory text and/or status |
| `PATCH` | `/api/memories/:id/approve` | Mark a memory approved |
| `DELETE` | `/api/memories/:id` | Delete one memory |

Memory routes exist in the backend, and matching helper functions exist in `src/api.ts`. The current Memories screen edits the shared `LocalData` object and syncs it through `/api/data`; it does not call those individual memory endpoints. `API_SPEC.md` currently documents the main app endpoints but does not list the memory routes.

## Important files

### Frontend

- `src/App.tsx` — app shell, screen selection, theme, API status, chat and Sleep Cycle wiring
- `src/main.tsx` — React entry point
- `src/api.ts` — typed API client
- `src/localData.ts` — data types, browser storage, validation, export helpers
- `src/useLocalData.ts` — local cache/backend synchronization
- `src/navigation.ts` — screen IDs and navigation metadata
- `src/themes.ts` — theme IDs and swatches
- `src/chatResponses.ts` — simulated demo responses and suggestions
- `src/components/LocalScreens.tsx` — memories, reminders, journal, settings, Sleep Cycle, and Morning Report screens
- `src/components/Chat.tsx` — chat interface
- `src/components/Dashboard.tsx` — dashboard content
- `src/components/AppNavigation.tsx` — desktop sidebar and mobile menu
- `src/components/AIBackground.tsx` — animated/background presentation
- `src/components/PageHeader.tsx` — shared page header
- `src/components/PlaceholderScreen.tsx` — placeholder component
- `src/index.css` — global styles, layout, themes, and animations

### Backend and project setup

- `server/index.mjs` — local HTTP server, SQLite schema, validation, API routes, provider integration
- `scripts/dev.mjs` — combined backend/frontend launcher and health-check logic
- `tests/backend.test.mjs` — persistence, AI consent/context, Sleep Cycle idempotency, and memory API tests
- `tests/dev-start.test.mjs` — verifies the launcher reuses a healthy backend
- `package.json` — scripts and dependencies
- `vite.config.ts` — Vite setup, `@` alias, and API proxy
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` — TypeScript configuration
- `eslint.config.js` — ESLint configuration
- `tailwind.config.js`, `postcss.config.js` — Tailwind/PostCSS configuration
- `index.html` — frontend HTML entry
- `.env.example` — example server-side AI and local database settings; contains no real key
- `README.md`, `ARCHITECTURE.md`, `API_SPEC.md`, `DATABASE_SCHEMA.md`, `AI_MEMORY_DESIGN.md`, `SLEEP_CYCLE_DESIGN.md`, `SECURITY_PRIVACY.md` — project documentation

## Privacy and limitations

- SQLite and browser local storage are not encrypted. Anyone with access to this device/account may be able to read them.
- There is no login, user isolation, hosted deployment, remote sync, backup system, or multi-device support.
- Keep the backend bound to loopback; do not expose it to a network.
- External AI sharing is off by default. When enabled, the limited context described above can leave the device and is subject to the provider's terms.
- Exported JSON is unencrypted. Deleting app data cannot erase exported files or backups.
- Reminders do not notify. Sleep Cycle does not run automatically.
- Automatic memory extraction, memory history/versioning, conflict detection, candidate approval/audit workflow, local model support, rollback, and replay evaluation are not implemented.
- Retrieval is based on lexical token overlap, not embeddings.

Do not paste or upload `.env` contents, API keys, `data/somnia.sqlite` or its SQLite WAL/SHM files, personal chat history, or private app records to ChatGPT. `node_modules/` and `dist/` are generated dependencies/build output and are not needed as project context. Ask for code changes against the current files rather than treating this summary as a substitute for reading them.

## Instructions for continuing work

When helping with Somnia:

1. Treat `project/` as the active app and inspect relevant files before proposing or making changes.
2. Preserve the local-first privacy model and the existing user-facing distinction between demo and real AI responses.
3. Do not claim a capability exists just because its screen or design document describes a future goal; verify the implementation.
4. Make focused changes, update directly related documentation, and run the smallest relevant checks. Prefer `npm run test:backend`, `npm run typecheck`, `npm run lint`, and `npm run build` as applicable.
5. If a requirement is ambiguous or could affect privacy, data retention, or product behavior, ask me before choosing an approach.
