# rag-document-assistant


A learning project building a document question-answering app with React, TypeScript, Express, and Gemini.

## Status

Tasks 1-3 are complete: non-streaming chat with loading and error handling. Task 4a passed a live streaming check. Task 4b implements client streaming and passes automated checks; successful browser streaming verification remains pending after live helper requests encountered upstream failures. Task 4c (Stop button) remains. Task 2b (retry and fallback) is deferred until before Task 12. PDF retrieval and citations are planned in [ROADMAP.md](ROADMAP.md).

## Local setup

1. Run `npm ci` separately in `client/` and `server/`.
2. Create `server/.env` with `PORT=5000` and `GEMINI_API_KEY=your_key_here` on separate lines.
3. Create `client/.env` with `VITE_API_URL=http://localhost:5000`.
4. In separate terminals, run `npm run dev` in `server/` and `client/`.
5. Open the URL printed by Vite, usually http://localhost:5173. Restart Vite after changing its environment file.

On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`. Both `.env` files are gitignored. Never place keys in client code or `VITE_` variables, which are exposed to the browser. The current server hardcodes its model; reading it from environment configuration is outstanding Task 2b work.

## Code organization

Currently, `client/src/App.tsx` contains chat layout, state, and requests; `types/chat.ts` defines messages; `App.css` and `index.css` provide styling. `server/src/index.ts` contains Express setup and the Gemini endpoint.

Create modules as features need them, following roadmap Part 2:

| Location | Responsibility |
|---|---|
| Client `components/` | UI components |
| Client `hooks/` | Reusable state behavior |
| Client `api/` | HTTP requests and stream parsing |
| Client `types/` | TypeScript data definitions |
| Server `routes/` | HTTP handlers |
| Server `services/` | Feature logic and external API calls |
| Server `db/` | Database access |

Task 4 introduces `api/chatStream.ts`; Task 9 includes the server route/service refactor. Keep refactors small and preserve existing behavior.

## Working process

1. Read the selected roadmap task, including its learning goals and acceptance checks.
2. Implement one task at a time and explain the core logic.
3. Run `npm run build` and `npm run lint` in `client/` for client changes, plus relevant browser/API checks. Run `npm test` in `server/` for streaming tests with mocked Gemini responses.
4. Review the diff and ensure secrets are excluded. Update status after checks pass, then make a focused commit.

Current chat checks: Enter displays an answer, Thinking appears while waiting, empty messages cannot be sent, and a stopped backend produces a friendly error. Restart the backend and confirm another message succeeds.

Follow the roadmap's $0 budget, typed code without `any`, and dependency rules. Streaming and RAG are implemented without LangChain or the Vercel AI SDK.

## Task 4a: server streaming

`POST /api/chat/stream` accepts `{ "message": "..." }` and sends SSE token events, an error event on failure, and a final `data: [DONE]` marker. The client now uses `/api/chat/stream`. The original JSON endpoint remains available.

The streaming route uses `GEMINI_MODEL` from `server/.env` when set, otherwise the existing server model name. No retry or fallback-model logic has been added. To test against Gemini, start the server, then run in PowerShell:

```powershell
'{"message":"Explain SSE in three short sentences."}' | curl.exe -N -X POST http://localhost:5000/api/chat/stream -H "Content-Type: application/json" --data-binary '@-'
```

Expect `data: {"type":"token","text":"..."}` events separated by blank lines, followed by `data: [DONE]`. `-N` disables curl output buffering. Press Ctrl+C during a long response to disconnect.

The handler lives in `server/src/routes/chatStream.ts`. It sets `Content-Type: text/event-stream` to identify the format, `Cache-Control: no-cache` to prevent cached reuse without validation, and `Connection: keep-alive` for the HTTP/1.1 connection. `X-Accel-Buffering: no` asks compatible proxies not to buffer. `flushHeaders()` sends the headers before waiting for Gemini. Each event ends with a blank line (`\n\n`); network chunks do not necessarily align with events.

Disconnecting aborts the local SDK request. This does not guarantee that Google's service stops generating or accounting for usage. Automated tests exercise this behavior with simulated responses and do not call Gemini.

## Task 4b: client streaming

`client/src/api/chatStream.ts` sends the question and reads SSE with a TextDecoder and an incomplete-event buffer. App adds an empty assistant message, appends tokens immutably, and restores the controls after success or failure. Partial answers remain visible on errors. The Stop button is deferred to Task 4c.

Run `npm test` in `client/` using Node 22.6+ (verified with Node 24.15.0). Tests cover fragmented UTF-8, event boundaries, completion, and failure handling without external API calls. Also run `npm run build` and `npm run lint`. With both servers running, submit a longer question and verify progressive text, scrolling, and another successful submission. Browser verification remains pending; the live helper has verified handling of the server error event.
