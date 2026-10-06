# Project guidance

Read ROADMAP.md fully before feature work, especially Parts 0-2 and the Status Tracker. It defines scope and target architecture.

Current status: Tasks 1, 2, 2b, 3, 4 (4a/4b/4c), 5, and 6 complete. Task 6 agent checks on 2026-10-06: 21 server tests, 12 browser tests, and server typecheck passed. Client unit tests (14), build, and lint passed for Task 5; client source was unchanged in Task 6. Uploads extract and chunk PDFs without persistence or chat integration. Task 7 is next. Earlier live Gemini streaming and JSON busy handling were verified on 2026-10-05; provider availability can vary. Task 3 manual checks were developer-confirmed; Task 5/6 checks are agent-run.

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
