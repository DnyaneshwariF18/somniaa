# API

The local Node backend listens on `127.0.0.1:8787`. During frontend development, Vite proxies `/api` to it. JSON errors use `{ "error": "..." }`; request bodies are limited to 1 MiB.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Backend, SQLite, AI configuration/consent mode, and scheduler status. |
| `GET` | `/api/data` | Load all current local application records; `data` is `null` before first initialization. |
| `PUT` | `/api/data` | Validate and transactionally replace the local user's settings and records. |
| `DELETE` | `/api/data` | Delete all local records and settings. The UI requires confirmation first. |
| `POST` | `/api/chat` | Send a message and recent history; uses demo mode unless provider and saved user consent are both enabled. |
| `POST` | `/api/sleep-cycle` | Run the backend memory-staleness check. Requires an `Idempotency-Key` header. |

## Chat privacy contract

`POST /api/chat` requires `message`, `history`, and the current `allowExternalAI` consent flag. The backend also checks the persisted consent setting. If either is false, or provider credentials/model are missing, the response is `{ "mode": "demo" }` and no external request is made. Otherwise it returns `{ "mode": "ai", "text": "..." }`.

The provider request contains the current message, up to eight recent messages, up to five text-matched approved memories, and up to three text-matched decision records. Archived memories are excluded. API keys stay server-side. A provider failure returns an explicit error; it is not converted into a success-shaped demo reply.

## Limitations

These are local development endpoints, not a public API: there is no authentication, user ID, hosted deployment, scheduler, notification delivery, full conversation model, or proposal/replay-evaluation endpoint. The SQLite database is single-user and local to the running installation.
