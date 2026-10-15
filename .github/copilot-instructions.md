# Repository guidance

Read and follow `AGENTS.md` and `ROADMAP.md` before working. They define learning boundaries, architecture, task scope, and acceptance checks.

Current status: Tasks 1 through 12 complete. Task 12 agent checks on 2026-10-15: 39 server tests, 17 client tests, server typecheck, client build/lint, and all 16 browser cases passed. The API has centralized safe JSON errors, 2,000-character chat limits, per-session/IP rate limiting, friendly provider/database/PDF/network handling, and client Retry actions. Task 8 live Atlas retrieval passed on 2026-10-14; Task 12 acceptance uses deterministic storage/provider fixtures through the real routes. `/api/debug/search` and the `/api/chat/stream` compatibility alias are temporary. Task 13 is next.
