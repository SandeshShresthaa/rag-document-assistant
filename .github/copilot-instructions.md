# Repository guidance

Read and follow `AGENTS.md` and `ROADMAP.md` before working. They define learning boundaries, architecture, task scope, and acceptance checks.

Current status: Tasks 1 through 10 complete. Task 10 agent checks on 2026-10-14: 32 server tests, 16 client tests, server typecheck, client build/lint, and all 14 browser cases passed. Grounded chat emits ordered citation sources and shows a collapsible Sources panel; no-context responses show none. Task 8 live Atlas retrieval passed earlier that day; Task 10 acceptance uses deterministic simulated retrieval/model responses through the real SSE handler. `/api/debug/search` and the `/api/chat/stream` compatibility alias are temporary. Task 11 is next.
