# Project guidance

Read ROADMAP.md fully before feature work, especially Parts 0-2 and the Status Tracker. It defines scope and target architecture.

Current status: Tasks 1 through 11 complete. Task 11 agent checks on 2026-10-14: 35 server tests, 16 client tests, server typecheck, client build/lint, and all 15 browser cases passed. Documents can be listed and deleted only by their owning anonymous session; deletion removes matching chunks, and uploads are limited to 5 documents and 500 chunks per session. Task 8 live Atlas retrieval passed earlier that day; Task 11 acceptance uses deterministic storage/provider fixtures through the real routes. `/api/debug/search` and the `/api/chat/stream` compatibility alias are temporary. Task 12 is next.

- Work on one requested task at a time. Explain what changes and why.
- Honor the developer's choice to write core logic personally; implement it when explicitly requested.
- Keep TypeScript simple and typed, without `any`. Explain dependencies before adding them unless the task lists them.
- Follow the $0 budget. Do not use LangChain or the Vercel AI SDK.
- Create modules as needed along roadmap Part 2 boundaries. Avoid unrelated refactors.
- Never print or commit secrets or put them in client code. Read server secrets from environment variables.
- Check official documentation when uncertain about library APIs.
- Run checks appropriate to the change. Client checks are `npm run build` and `npm run lint` in client/. Server tests run with `npm test` and type checking with `npm run typecheck` in server/. Client browser checks run with `npm run test:browser`; these use simulated Gemini responses and the real SSE handler.
- Update status after acceptance checks pass. Distinguish developer-confirmed checks from agent-run checks.
- Report files changed, validation, limitations, and a suggested commit message. Do not commit or push unless requested.
