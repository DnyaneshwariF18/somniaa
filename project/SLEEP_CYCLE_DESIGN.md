# Sleep Cycle design

## Current backend review

The user can manually run Sleep Cycle through `POST /api/sleep-cycle`. The backend checks approved memories for an `updatedAt` timestamp more than 180 days old and persists the run time plus matching memory IDs in SQLite. An idempotency key prevents duplicate runs after a retry. The 180-day cutoff is a simple review reminder, not proof that a memory is incorrect or stale.

The check is deterministic, uses no AI, and reads no chat history. It runs only when triggered manually; there is no scheduler. Run history is synchronized to the browser cache.

Morning Report shows the latest saved run and the memory entries it marked for review. It does not fabricate proposals, contradictions, AI summaries, replay scores, or approvals.

## Not implemented

There is no configured recurring scheduler, replay evaluation framework, candidate insight generation, proposal approval workflow, or notification. The backend job is an on-demand endpoint, not an unattended night-time service.
