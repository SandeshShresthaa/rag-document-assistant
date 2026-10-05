# Project guidance

Read ROADMAP.md fully before feature work, especially Parts 0-2 and the Status Tracker. It defines scope and target architecture.

Current status: Tasks 1-3 complete; Task 4a verified with a live Gemini stream. Task 4b implemented; client build, lint, and 11 streaming tests pass. Live client-helper attempts received upstream error events; successful browser streaming verification remains pending. Task 4c remains. Task 2b deferred until before Task 12.

- Work on one requested task at a time. Explain what changes and why.
- Honor the developer's choice to write core logic personally; implement it when explicitly requested.
- Keep TypeScript simple and typed, without `any`. Explain dependencies before adding them unless the task lists them.
- Follow the $0 budget. Do not use LangChain or the Vercel AI SDK.
- Create modules as needed along roadmap Part 2 boundaries. Avoid unrelated refactors.
- Never print or commit secrets or put them in client code. Read server secrets from environment variables.
- Check official documentation when uncertain about library APIs.
- Run checks appropriate to the change. Client checks are `npm run build` and `npm run lint` in client/. Server streaming tests run with `npm test` in server/ using mocked Gemini responses.
- Update status after acceptance checks pass. Distinguish developer-confirmed checks from agent-run checks.
- Report files changed, validation, limitations, and a suggested commit message. Do not commit or push unless requested.
