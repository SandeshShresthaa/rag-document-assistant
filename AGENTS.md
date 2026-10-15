# Project guidance

Read ROADMAP.md fully before feature work, especially Parts 0-2 and the Status Tracker. It defines scope and target architecture.

Current status: Tasks 1 through 13 complete. Task 13 agent checks on 2026-10-15: 40 server tests and server typecheck passed; the deterministic 15-question Apollo 11 evaluation scored 83% retrieval hits, 83% answer keyword accuracy, and 3/3 correct refusals across three configurations. Optional live Atlas/Gemini evaluation is implemented but no live score is claimed. Task 12 client checks remain 17 unit tests, build/lint, and 16 browser cases. `/api/debug/search` and the `/api/chat/stream` compatibility alias are temporary. Task 14 is next.

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
