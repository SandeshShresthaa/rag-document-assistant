# Repository guidance

Read and follow `AGENTS.md` and `ROADMAP.md` before working. They define learning boundaries, architecture, task scope, and acceptance checks.

Current status: Tasks 1 through 11 complete. Task 11 agent checks on 2026-10-14: 35 server tests, 16 client tests, server typecheck, client build/lint, and all 15 browser cases passed. Documents can be listed and deleted only by their owning anonymous session; deletion removes matching chunks, and uploads are limited to 5 documents and 500 chunks per session. Task 8 live Atlas retrieval passed earlier that day; Task 11 acceptance uses deterministic storage/provider fixtures through the real routes. `/api/debug/search` and the `/api/chat/stream` compatibility alias are temporary. Task 12 is next.
