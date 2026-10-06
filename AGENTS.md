# Project guidance

Read ROADMAP.md fully before feature work, especially Parts 0-2 and the Status Tracker. It defines scope and target architecture.

Current status: Tasks 1, 2, 2b, 3, 4 (4a/4b/4c), and 5 complete. Agent checks on 2026-10-06: 14 client tests, 14 server tests, 12 browser checks, client build/lint, and server typecheck passed. Task 5 uploads/extracts PDFs without persistence or chat integration. Task 6 is next. Earlier live Gemini streaming and JSON busy handling were verified on 2026-10-05; provider availability can vary. Task 3 manual checks were developer-confirmed; Task 5 checks are agent-run.

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
