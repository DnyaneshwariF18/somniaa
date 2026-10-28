# AI and memory design

## Current behavior

The backend has an optional OpenAI-compatible chat-completions adapter. It is inactive unless the server has a base URL, API key, and model configured and the user enables external AI sharing in Settings. Otherwise `src/chatResponses.ts` chooses a clearly labelled illustrative demo response. The backend never returns a demo response as if a provider call succeeded.

Memory records are still entered directly by the user and marked approved by that explicit action. Chat retrieval uses a small text-matched subset of approved memories only after external AI consent. Archived memories are not sent. Decision records are separately labelled as user-recorded rationale in the model instructions. Somnia does not infer facts from chat, automatically approve suggestions, or add memories during a Sleep Cycle run.

## Provider setup

Copy `.env.example` to `.env` and configure `SOMNIA_AI_BASE_URL`, `SOMNIA_AI_API_KEY`, and `SOMNIA_AI_MODEL`. The API key remains in the backend process. Review `SECURITY_PRIVACY.md` before enabling sharing. Provider failures are reported in chat and are not hidden by falling back to demo output.

## Not implemented

Automatic memory extraction, candidate review, memory version history, conflict detection, a local-model adapter, and rollback remain future work. The current retrieval uses lexical overlap rather than embeddings.
