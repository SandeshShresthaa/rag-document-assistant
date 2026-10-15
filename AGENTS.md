# Project guidance

Read ROADMAP.md fully before feature work, especially Parts 0-2 and the Status Tracker. It defines scope and target architecture.

Current status: Tasks 1 through 14 complete. Task 14 agent checks on 2026-10-15: 17 client tests, client build/lint, and all 18 browser cases passed. The responsive UI renders safe Markdown, provides Copy controls, uses upload-first empty states, disables chat without documents, and passes a 390-pixel mobile overflow check. Task 13 server checks remain 40 tests and typecheck. `/api/debug/search` and the `/api/chat/stream` compatibility alias are temporary. Task 15 is next.

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
