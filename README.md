# rag-document-assistant


A learning project building a document question-answering app with React, TypeScript, Express, and Gemini.

## Status

Tasks 1 through 12 are complete. PDFs are extracted, chunked, embedded with Gemini, stored in MongoDB, retrieved through Atlas Vector Search, and passed to a grounded streaming chat prompt with citations. Anonymous sessions isolate document access. Input limits, rate limiting, safe API errors, provider/PDF/network handling, stream cancellation, and Retry actions keep the UI recoverable. Task 13 (evaluation) is next. See [ROADMAP.md](ROADMAP.md) for the remaining plan.

## Local setup

1. Run `npm ci` separately in `client/` and `server/`.
2. Copy `server/.env.example` to `server/.env`. Set `GEMINI_API_KEY`, the generation model, `GEMINI_EMBEDDING_MODEL`, and your Atlas `MONGODB_URI`. Keep `EMBEDDING_DIMENSIONS=768` and `MONGODB_DB=ragdocs` unless you intentionally configure different values.
3. Create `client/.env` with `VITE_API_URL=http://localhost:5000`.
4. In separate terminals, run `npm run dev` in `server/` and `client/`.
5. Open the URL printed by Vite, usually http://localhost:5173. Restart Vite after changing its environment file.

On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`. Both `.env` files are gitignored. Never place keys in client code or `VITE_` variables, which are exposed to the browser. Both endpoints read model configuration from `server/.env`. Retry only 429/503 with three total attempts per model and 1s/2s waits. A missing model (404) switches directly to the optional fallback. Other errors fail immediately.

## Code organization

`client/src/App.tsx` contains chat layout/state and calls `api/chatStream.ts`; `hooks/useSessionId.ts` keeps one anonymous UUID in local storage. On the server, `index.ts` wires Express and Gemini to the routes. `services/embeddings.ts` batches document embeddings, `db/mongo.ts` reuses one MongoDB client, and `db/documents.ts` stores document and chunk records.

`services/retrieval.ts` embeds questions and queries the Atlas `chunk_vector_index`. During development, `GET /api/debug/search?q=...&sessionId=...` returns ranked chunks and scores; remove this debug route before deployment.

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

The app streams grounded RAG answers and source metadata through the same SSE response. Keep refactors small and preserve existing behavior.

## Working process

1. Read the selected roadmap task, including its learning goals and acceptance checks.
2. Implement one task at a time and explain the core logic.
3. Run `npm run build` and `npm run lint` in `client/` for client changes, plus relevant browser/API checks. Run `npm test` in `server/` for streaming tests with mocked Gemini responses.
4. Review the diff and ensure secrets are excluded. Update status after checks pass, then make a focused commit.

Current chat checks: Enter displays an answer, Thinking appears while waiting, empty messages cannot be sent, and a stopped backend produces a friendly error. Restart the backend and confirm another message succeeds.

Follow the roadmap's $0 budget, typed code without `any`, and dependency rules. Streaming and RAG are implemented without LangChain or the Vercel AI SDK.

## Task 4a: server streaming

`POST /api/chat` accepts `{ "message": "...", "sessionId": "...", "documentIds": [] }` and sends SSE token events, an error event on failure, and a final `data: [DONE]` marker. The client uses `/api/chat`; `/api/chat/stream` is a temporary compatibility alias.

Both routes require `GEMINI_MODEL` from `server/.env`. Streaming setup retries use an abortable wait; failures after tokens begin are reported without restarting the answer. To test against Gemini, start the server, then run in PowerShell:

```powershell
'{"message":"What does this document explain?","sessionId":"YOUR-BROWSER-SESSION-UUID"}' | curl.exe -N -X POST http://localhost:5000/api/chat -H "Content-Type: application/json" --data-binary '@-'
```

Expect `data: {"type":"token","text":"..."}` events separated by blank lines, followed by `data: [DONE]`. `-N` disables curl output buffering. Press Ctrl+C during a long response to disconnect.

The handler lives in `server/src/routes/chat.ts`, with Gemini access in `server/src/services/llm.ts`. It sets `Content-Type: text/event-stream` to identify the format, `Cache-Control: no-cache` to prevent cached reuse without validation, and `Connection: keep-alive` for the HTTP/1.1 connection. `X-Accel-Buffering: no` asks compatible proxies not to buffer. `flushHeaders()` sends the headers before retrieval and generation. Each event ends with a blank line (`\n\n`); network chunks do not necessarily align with events.

Disconnecting aborts the local SDK request. This does not guarantee that Google's service stops generating or accounting for usage. Automated tests exercise this behavior with simulated responses and do not call Gemini.

## Task 4b: client streaming

`client/src/api/chatStream.ts` sends the question and anonymous session ID, then reads SSE with a TextDecoder and an incomplete-event buffer. App adds an empty assistant message, appends tokens immutably, and restores the controls after success or failure. Partial answers remain visible on errors. While loading, Stop aborts the request and preserves partial text. Send returns after cleanup; aborting is not an error.

Run `npm test` in `client/` using Node 22.6+ (verified with Node 24.15.0). Tests cover fragmented UTF-8, event boundaries, completion, and failure handling without external API calls. Also run `npm run build` and `npm run lint`. With both servers running, submit a longer question and verify progressive text, scrolling, and another successful submission. Browser verification passed using a deterministic model fixture and the actual SSE handler. Live Gemini streaming was also verified separately.

## Task 4c and Phase 1 validation

The controller lives in a React ref. It is passed to fetch, aborted by Stop, and cleaned up when the component unmounts. The reader ignores queued tokens after cancellation. The server detects disconnects and aborts its SDK request. Remote generation cancellation is not guaranteed by Gemini.

Validation on 2026-10-05:

- 14 client parser/cancellation tests passed (`npm test` in client/).
- 11 server route/retry tests passed (`npm test` in server/).
- Six real-browser tests passed (`npm run test:browser` in client/): progressive rendering, empty input/loading, Stop before/after first token, post-stop recovery, mid-stream errors, network failure, and navigation cancellation.
- Client build/lint and server `npm run typecheck` passed.
- GitHub origin is configured; both environment files are ignored and untracked.
- A live Gemini stream returned text and [DONE]. A live JSON request exhausted busy retries and correctly returned friendly HTTP 503. Free-tier availability remains variable.

Browser tests launch isolated test servers on ports 5051 and 5174 and use a fake model, so they do not consume Gemini quota. Windows uses installed Edge by default; other systems use Playwright Chromium (install with `npx playwright install chromium`). Set `PLAYWRIGHT_CHANNEL` to override the browser. Playwright is a development dependency only. Install both client and server dependencies before running these tests.
