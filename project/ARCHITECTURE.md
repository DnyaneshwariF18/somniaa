# Architecture

## Components

- Frontend: React + TypeScript + Vite. Existing screens and presentation remain in `src/components`.
- API: Node's built-in HTTP server in `server/index.mjs`; it binds to `127.0.0.1` and uses no third-party backend packages.
- Storage: Node's built-in `node:sqlite` with SQLite tables for settings, chat messages, memories, reminders, decisions, and Sleep Cycle runs.
- LLM: An OpenAI-compatible chat-completions adapter in the backend. Provider URLs, model, and API key come from server environment variables; credentials never enter the Vite bundle.

## Data flow

1. `useLocalData` loads the browser cache and synchronizes with `GET /api/data`.
2. On the first backend launch, existing browser data is imported if the SQLite database is empty. Later backend data is the source of truth and refreshes the browser cache.
3. UI changes update the local cache immediately and are serialized to `PUT /api/data`; errors are surfaced in the UI.
4. Chat calls `POST /api/chat`. The backend enforces saved user consent and provider configuration, retrieves only relevant approved memories and recorded decisions, then calls the provider. Without consent or configuration, it returns an explicit demo-mode response selection.
5. `POST /api/sleep-cycle` performs the deterministic review in the backend and stores a run with an idempotency key.

## Running

Use Node.js 22.13+ and `npm run dev:all`. Vite proxies `/api` to the backend on port 8787. The database defaults to `data/somnia.sqlite`; configure `SOMNIA_DB_PATH` and `SOMNIA_PORT` if needed. `.env.example` lists supported AI settings.

## Boundaries

The backend is a single-user local application, not a multi-user hosted service. It has no login, account isolation, remote hosting, or database encryption. Keep it bound to loopback (`127.0.0.1`). Browser storage is retained as a cache, not a secure vault.

The AI adapter does not retrain models or store provider-side data itself. External requests are made only when the provider is configured and the user enables sharing in Settings. Memory proposal extraction and contradiction detection run safely in both AI and offline demo modes. The Sleep Cycle features an automated background scheduler alongside manual on-demand triggers to review approved memories for staleness. In-app and desktop browser notifications provide real-time alerts for due reminders.
