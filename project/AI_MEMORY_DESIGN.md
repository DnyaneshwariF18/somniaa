# AI and memory design

## Current behavior

The backend has an optional OpenAI-compatible chat-completions adapter. It is inactive unless the server has a base URL, API key, and model configured and the user enables external AI sharing in Settings. Otherwise `src/chatResponses.ts` chooses a clearly labelled illustrative demo response. The backend never returns a demo response as if a provider call succeeded.

Memory records are user-approved records. Chat retrieval uses multi-tier keyword matching (lowercasing, punctuation stripping, word stemming, stop-word filtering, and synonym expansion) alongside recent conversational history to accurately retrieve approved facts even when questions are paraphrased. Archived memories are strictly excluded and never enter the prompt.

Memory proposal extraction automatically detects explicitly stated candidate facts from user chat messages (preferences, ongoing goals, routines, and life changes) while rejecting hypothetical questions, speculations, or quotes attributed to others. Facts are surfaced as proposals with Approve, Dismiss, and Replace actions. Contradictions between proposed facts and existing memories are detected and flagged with amber warnings and one-click replacement.

## Provider setup

Copy `.env.example` to `.env` and configure `SOMNIA_AI_BASE_URL`, `SOMNIA_AI_API_KEY`, and `SOMNIA_AI_MODEL`. The API key remains in the backend process. Review `SECURITY_PRIVACY.md` before enabling sharing. Provider failures are reported in chat and are not hidden by falling back to demo output. When sharing is disabled, Somnia runs in local demo mode with local proposal extraction and zero external API calls.
