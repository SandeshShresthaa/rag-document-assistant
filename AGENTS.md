# Project guidance

Read ROADMAP.md fully before feature work, especially Parts 0-2 and the Status Tracker. It defines scope and target architecture.

Current status: Tasks 1 through 9 complete. Task 9 checks on 2026-10-14: 32 server tests, 14 client tests, server typecheck, client build/lint, and all 12 browser cases passed. Chat retrieves by session, applies a 0.70 score threshold, builds a grounded prompt, streams through `/api/chat`, and refuses without calling Gemini when context is missing. Task 8 live Atlas retrieval passed earlier that day; fresh Task 9 live attempts hit transient Atlas TLS failures and a Gemini stream that produced no token for 90 seconds, so no fresh live Task 9 provider result is claimed. `/api/debug/search` and the `/api/chat/stream` compatibility alias are temporary. Task 10 is next.

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
