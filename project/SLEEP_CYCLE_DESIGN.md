# Sleep Cycle design

## Current backend review

The user can manually run Sleep Cycle through `POST /api/sleep-cycle`, and an automated background scheduler checks every 24 hours to review approved memories for staleness (memories with `updatedAt` older than 180 days). The run timestamp and stale memory IDs are persisted in SQLite, and an idempotency key prevents duplicate execution on retries.

The check is deterministic, operates entirely on the local SQLite database, and requires no external network calls. Run history is mirrored to the local cache and health status reports `scheduledJobs: true`.

Morning Report displays the latest Sleep Cycle run, lists stale memories for review, and includes a Memory Contradiction Review section that surfaces any conflicting approved facts with one-click resolution.

## Operational Boundaries

The automated scheduler runs in the background of the Node.js backend process with unreferenced intervals. It does not auto-mutate or delete user memories; all modifications and archival actions require explicit user choice.
