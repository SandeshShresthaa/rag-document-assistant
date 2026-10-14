# Repository guidance

Read and follow `AGENTS.md` and `ROADMAP.md` before working. They define learning boundaries, architecture, task scope, and acceptance checks.

Current status: Tasks 1 through 8 complete. Task 8 checks on 2026-10-14: 32 server tests and server typecheck passed; the live Atlas vector index reached READY, five semantic questions returned the expected page first (scores 0.8393-0.8902), a different session returned no results, and a document filter returned only the selected document. `/api/debug/search` is temporary and must be removed before deployment. Task 9 is next. Task 7 client checks remain 14 unit tests, build/lint, and 12 browser cases passed. Earlier live Gemini streaming and JSON busy handling were verified on 2026-10-05; provider availability can vary.
