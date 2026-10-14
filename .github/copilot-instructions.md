# Repository guidance

Read and follow `AGENTS.md` and `ROADMAP.md` before working. They define learning boundaries, architecture, task scope, and acceptance checks.

Current status: Tasks 1 through 9 complete. Task 9 checks on 2026-10-14: 32 server tests, 14 client tests, server typecheck, client build/lint, and all 12 browser cases passed. Chat retrieves by session, applies a 0.70 score threshold, builds a grounded prompt, streams through `/api/chat`, and refuses without calling Gemini when context is missing. Task 8 live Atlas retrieval passed earlier that day; fresh Task 9 live attempts hit transient Atlas TLS failures and a Gemini stream that produced no token for 90 seconds, so no fresh live Task 9 provider result is claimed. `/api/debug/search` and the `/api/chat/stream` compatibility alias are temporary. Task 10 is next.
