# Security and privacy

## Current protections

- The backend binds to `127.0.0.1`; it rejects non-local Host and Origin values.
- AI provider credentials are read by the backend from environment variables and are not included in frontend code.
- External AI sharing is off by default and needs explicit opt-in in Settings. The server independently checks stored consent and the request's current consent flag.
- The provider receives only a short recent chat window and text-matched approved memories/decision entries; archived memories are excluded.
- API input shape and request size are validated. Database replacement is transactional. Sleep Cycle supports idempotent retries.
- Storage and provider failures are surfaced rather than silently treated as success.

## Limits

This is a local single-user development backend, not a hardened public service. It has no login, authentication, account isolation, remote authorization, encryption at rest, backups, or multi-device sync. SQLite and the browser cache are readable by anyone with access to the device account. Do not store highly sensitive information and do not expose the backend port to a network.

If a user enables an external provider, the current message and a limited contextual subset may leave the device and be processed under that provider's terms. Configure only a provider whose data-processing practices you accept. Disabling consent prevents subsequent requests from using the provider; it cannot recall data already sent.

## Retention and deletion

Records remain in the local SQLite database and browser cache until edited or deleted from Settings. The export is plain JSON and is not encrypted. Deleting data clears the app tables, but does not erase backups or files the user previously exported.

Reminders do not deliver notifications. Sleep Cycle does not run on a schedule. No retention period or automatic cleanup policy is configured.
