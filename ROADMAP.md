# ROADMAP: rag-document-assistant

> This file is for BOTH the developer (Sasss) and AI coding agents (GitHub Copilot, Codex).
> Read "Part 0" and "Part 1" fully before doing any task. Then work on ONE task at a time.

---

## Part 0. How to use this file

### For the developer
1. Find the first task with an unchecked box in the **Status Tracker**.
2. Read the task: Goal, What you will learn, Steps, Done when.
3. Do the "Write it yourself" parts by hand. Use the AI agent for the "Agent can do this" parts.
4. Use the **Agent prompt** in each task as a starting prompt (edit it freely).
5. Test using the "Done when" checklist. Commit with the suggested message. Tick the box.
6. Update the "Current status" line in `AGENTS.md` and `.github/copilot-instructions.md`.

### For AI agents (read this carefully)
- Work on **one task at a time**, the one the developer names. Do not jump ahead.
- This is a **learning project**. Explain what you change and why, in simple words.
- Keep code **simple, readable, and typed** (TypeScript, no `any`).
- Do **not** add dependencies unless the task lists them or you explain why first.
- Do **not** use the Vercel AI SDK or LangChain. Streaming and RAG are built by hand on purpose.
- Never hardcode secrets. Read them from `server/.env`. Never print API keys.
- Library and model names change often. If unsure of an API, check the official docs instead of guessing.
- After finishing, list: files changed, how to test, and what to commit.
- If a requirement is unclear, ask a short question instead of guessing.

### Learning rule: "Write it yourself" vs "Agent can do this"
Each task marks what the developer should type by hand (core concepts, interview topics) and what an agent can generate (boilerplate, styling). The goal is to be able to explain every line.

---

## Part 1. Project overview

### What we are building
A "chat with your documents" web app. A user uploads PDFs, asks questions in a chat UI, and gets answers that:
- stream in token by token,
- are based ONLY on the uploaded documents (RAG),
- show source citations (document name + page + snippet).

### Why (goals)
1. Learn practical AI engineering: LLM APIs, streaming, embeddings, vector search, RAG, evaluation.
2. Build a strong portfolio project for frontend / full-stack developer job applications.

### Non-goals (do NOT build these unless in Stretch)
- No user accounts or login (use an anonymous session id).
- No payments, no admin panel.
- No fine-tuning or training models.
- No LangChain / Vercel AI SDK.

### Hard constraints
- **$0 budget.** Only free tiers: Gemini API free tier, MongoDB Atlas M0, Vercel, Render, GitHub.
- Free tiers have rate limits and can return 429 (rate limit) or 503 (model busy). Handle both gracefully.
- Machine: 16GB RAM, so local-model fallback (Ollama) must use small models only.

### Tech stack
| Part | Choice |
|---|---|
| Client | React + Vite + TypeScript (`client/`) |
| Server | Node + Express + TypeScript, ES modules, run with `tsx` (`server/`) |
| LLM | Google Gemini via `@google/genai` |
| Embeddings | Gemini embedding model (name from `.env`) |
| Database | MongoDB Atlas free tier (M0) with Atlas Vector Search |
| PDF parsing | `multer` (upload) + a PDF text extraction library (see Task 5) |
| Hosting | Vercel (client), Render (server) |

---

## Part 2. Architecture

### Request flow (final system)

```
UPLOAD FLOW
Browser --PDF--> POST /api/documents
   Server: save file in memory -> extract text per page -> split into chunks
        -> create embedding for each chunk -> store chunks in MongoDB

CHAT FLOW
Browser --question--> POST /api/chat  (streams back with SSE)
   Server: embed question -> vector search top-k chunks in MongoDB
        -> build prompt (instructions + chunks + question)
        -> stream Gemini answer token by token to browser
        -> send sources (chunks used) to browser
Browser: shows streaming text + a Sources panel
```

### Final folder structure (target)

```
rag-document-assistant/
  AGENTS.md
  ROADMAP.md
  README.md
  .gitignore
  .github/copilot-instructions.md
  client/
    src/
      App.tsx
      api/            # fetch helpers (chatStream, uploadDocument, listDocuments...)
      components/     # ChatWindow, MessageBubble, SourcesPanel, UploadBox, DocumentList
      hooks/          # useChat, useSessionId
      types/          # shared TypeScript types
  server/
    src/
      index.ts        # app setup only (middleware + routes)
      config.ts       # reads env vars in one place
      routes/         # chat.ts, documents.ts
      services/       # llm.ts, embeddings.ts, pdf.ts, chunker.ts, retrieval.ts
      db/             # mongo.ts (connection), models/types
      utils/          # errors, sse helpers
    eval/             # test questions + eval script (Task 13)
```

Do not create all folders at once. Create them when the task needs them. Refactor `index.ts` into routes/services gradually (Task 9 is a good time).

### Environment variables (`server/.env`, never commit)

```
PORT=5000
GEMINI_API_KEY=...
GEMINI_MODEL=<current free Flash model name from AI Studio>
GEMINI_FALLBACK_MODEL=<optional second model>
GEMINI_EMBEDDING_MODEL=<current free embedding model name>
EMBEDDING_DIMENSIONS=768
MONGODB_URI=...
MONGODB_DB=ragdocs
CLIENT_ORIGIN=http://localhost:5173
```

Client (`client/.env`): `VITE_API_URL=http://localhost:5000`

### API contract (final)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/chat` | Body: `{ message, sessionId, documentIds? }`. Streams SSE events. |
| POST | `/api/documents` | multipart upload (`file`) + `sessionId`. Returns `{ documentId, name, pages, chunks }`. |
| GET | `/api/documents?sessionId=` | List documents for a session. |
| DELETE | `/api/documents/:id?sessionId=` | Delete a document and its chunks. |
| GET | `/api/health` | Returns `{ ok: true }` (useful for Render cold start). |

SSE events sent by `/api/chat` (each line is `data: <json>\n\n`):
- `{ "type": "token", "text": "..." }` for each piece of the answer
- `{ "type": "sources", "sources": [{ "documentName", "page", "snippet" }] }` once, before or after tokens
- `{ "type": "error", "message": "..." }` on failure
- `[DONE]` as the last data line

### Data model (MongoDB)

Collection `documents`:
```
{ _id, sessionId, name, pages, chunkCount, createdAt }
```
Collection `chunks`:
```
{ _id, documentId, sessionId, documentName, page, chunkIndex, text, embedding: number[], createdAt }
```

---

## Part 3. Status Tracker

Tick boxes as you finish. (Developer: update this and the "Current status" line in the agent files.)

**Phase 1: Streaming chat**
- [x] Task 1: Project setup + GitHub
- [x] Task 2: First LLM call from backend
- [x] Task 2b: Retry + model fallback
- [x] Task 3: Basic chat UI
- [x] Task 4: Streaming with SSE

**Phase 2: Documents and retrieval**
- [x] Task 5: PDF upload + text extraction
- [ ] Task 6: Chunking
- [ ] Task 7: Embeddings + MongoDB storage
- [ ] Task 8: Vector search
- [ ] Task 9: Connect retrieval to chat (RAG)

**Phase 3: Make it trustworthy**
- [ ] Task 10: Citations
- [ ] Task 11: Multiple documents + session separation
- [ ] Task 12: Error handling + edge cases
- [ ] Task 13: Evaluation

**Phase 4: Polish and ship**
- [ ] Task 14: UI polish
- [ ] Task 15: Deploy
- [ ] Task 16: README + demo
- [ ] Task 17: CV + LinkedIn

---

# PHASE 1: Streaming chat

## Task 1: Project setup [DONE]
Repo `rag-document-assistant`, `client/` (Vite React TS), `server/` (Express TS), `.gitignore`, README.

## Task 2: First LLM call from backend [DONE]
`POST /api/chat` in `server/src/index.ts` takes `{ message }`, calls Gemini with `@google/genai`, returns `{ reply }`.

Lessons learned (keep in mind):
- Model names get retired. Read the model name from `.env`.
- Gemini can return 503 (busy) or 429 (rate limit). See Task 2b.

---

## Task 2b: Retry + model fallback [DONE]

**Goal:** Make the server survive temporary Gemini 503/429 errors.

**You will learn:** exponential backoff, graceful degradation, error status codes.

**Steps**
1. Read `GEMINI_MODEL` and optional `GEMINI_FALLBACK_MODEL` from env (via `config.ts` or top of file).
2. Use `generateWithRetry`: try each model up to 3 times total, with 1s and 2s waits between attempts; only retry 503/429. After exhaustion, try the optional fallback. A 404 skips directly to the fallback without retrying the missing model; other errors fail immediately. This resolves the original conflict between three attempts and three delays, and makes the missing-model acceptance check explicit.
3. In the route's `catch`, return HTTP 503 with `{ error: "The AI model is busy. Please try again in a moment." }` for 503/429, else 500.

**Write it yourself:** the retry loop.
**Agent can do this:** typing the `status` check helper, reviewing your loop.

**Agent prompt:** "Review my `generateWithRetry` in server/src/index.ts. It should retry only on 503/429 with exponential backoff and then try a fallback model. Point out bugs; don't rewrite everything."

**Done when:** a simulated missing first model (404) falls back successfully; exhausted 429/503 failures produce the friendly JSON error.

Validation: automated tests cover bounded backoff, fallback, permanent failures, cancellation during backoff, and JSON status mapping. A live JSON request exhausted busy retries and returned the expected friendly HTTP 503. `GEMINI_MODEL` is now read from the ignored server environment file; `GEMINI_FALLBACK_MODEL` remains optional. Stream setup uses the same retry helper; failures after tokens begin are reported without restarting the answer.
**Commit:** `feat: add retry and model fallback for busy API errors`

---

## Task 3: Basic chat UI

**Goal:** A working chat screen that talks to `/api/chat` (non-streaming).

**You will learn:** React state for chat, calling an API, loading and error states.

**Steps**
1. Create `client/.env` with `VITE_API_URL=http://localhost:5000`.
2. Define type `Message = { role: "user" | "assistant"; text: string }` (put in `src/types/chat.ts`).
3. In `App.tsx` keep state: `messages`, `input`, `loading`, `error`.
4. `sendMessage`: trim input, ignore if empty or loading, add the user message, POST to `${VITE_API_URL}/api/chat`, add assistant message from `data.reply`.
5. UI: scrollable message list, input, Send button (disabled while loading), "Thinking..." bubble, red error line.
6. Press Enter to send. Auto-scroll to the newest message (`useRef` + `scrollIntoView`).
7. Clean the Vite starter CSS. Basic styling (you may use MUI since you know it).

**Write it yourself:** `sendMessage` and state handling.
**Agent can do this:** CSS, layout, auto-scroll.

**Agent prompt:** "Implement Task 3 from ROADMAP.md in client/src. Basic chat UI, React + TypeScript, calls POST /api/chat, shows loading and error states, no streaming yet. Don't add libraries."

**Done when**
- [x] Typing a question and pressing Enter shows the answer
- [x] "Thinking..." appears while waiting
- [x] Stopping the server and sending shows a friendly error (no crash)
- [x] Empty messages cannot be sent

Validation: client build and lint passed; the developer confirmed all four browser checks on 2026-10-05.

**Pitfalls:** CORS errors (server must call `cors()`); forgetting to run both servers; `VITE_` prefix required for client env vars (restart Vite after editing `.env`).
**Commit:** `feat: add basic chat UI`

---

## Task 4: Streaming with SSE (most important learning task)

**Goal:** Answers appear word by word, with a Stop button.

**You will learn:** Server-Sent Events, streaming responses in Express, reading a stream in the browser with `fetch` + `ReadableStream`, `AbortController`. This is the most common AI-frontend interview topic.

**Concepts**
- SSE = the server keeps the HTTP response open and writes lines like `data: {...}\n\n`.
- Browser `EventSource` only supports GET, so for a POST with a body we use `fetch` and read `response.body` manually.

**Part 4a: Server**

Implementation status: complete. The client uses `POST /api/chat/stream`; the original JSON `/api/chat` remains available. Server tests verify progressive delivery, validation, failures, and disconnect/recovery; strict TypeScript checking passes. Live Gemini streaming returned tokens and [DONE] on 2026-10-05, including a fresh check after Task 4c.

1. Add a new streaming route (or change `/api/chat`): set headers
   `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, then `res.flushHeaders()`.
2. Call `ai.models.generateContentStream({ model, contents })` and loop `for await (const chunk of stream)`.
3. For each chunk with text: `res.write(`data: ${JSON.stringify({ type: "token", text })}\n\n`)`.
4. After the loop: `res.write("data: [DONE]\n\n"); res.end()`.
5. On error after headers are sent: write `{ type: "error", message }` then end. (You cannot change the status code after streaming starts.)
6. Listen to `res.on("close", ...)` and abort the SDK request if the response has not ended. Request `close` can mean the POST body completed normally. Pass the abort signal through Gemini's config; aborting stops local consumption but does not guarantee cancellation of generation at Google's service.

**Part 4b: Client**

Implementation status: complete. `client/src/api/chatStream.ts` buffers SSE events and App appends tokens to one assistant message, scrolling as it grows. Client build/lint and 14 parser/cancellation tests pass. Browser tests confirm progressive rendering, loading, error recovery, and subsequent requests using the real SSE route with simulated model responses.
1. Create `src/api/chatStream.ts` exporting `streamChat(message, { onToken, onDone, onError, signal })`.
2. `fetch` with POST and `signal`. Get `res.body.getReader()` and a `TextDecoder`.
3. Read chunks in a loop, append to a buffer, split by `\n\n`, parse lines starting with `data: `. Keep the incomplete last piece in the buffer (a network chunk can cut an event in half).
4. Call `onToken(text)` for token events; stop at `[DONE]`.
5. In `App.tsx`: add an empty assistant message first, then append each token to the LAST message (immutable update).

**Part 4c: Stop button**

Implementation status: complete. A controller ref prevents duplicate requests and aborts on Stop or unmount. Aborts do not show errors; partial answers remain visible. Browser tests verify Stop before the first token, Stop during generation, server-side abort, and a successful subsequent message.
1. Keep an `AbortController` in a `useRef`. Pass `signal` to fetch.
2. "Stop" button calls `controller.abort()`. Treat `AbortError` as a normal stop (not an error message).
3. Show Stop while streaming, Send otherwise.

**Write it yourself:** the SSE buffer-parsing loop and abort logic.
**Agent can do this:** button styling, TypeScript types for events.

**Agent prompt:** "Implement Task 4a (server SSE streaming with generateContentStream) per ROADMAP.md. Explain each header and why we split events on a blank line. Do not use any streaming libraries."

**Done when**
- [x] Text appears progressively in the UI
- [x] Stop halts the stream and the server aborts its SDK request (remote generation cancellation is not guaranteed by the provider)
- [x] A mid-stream error shows a message and the UI recovers
- [x] Sending a second message after a stop works

Validation (2026-10-05): 14 client tests, 11 server tests, and six Edge browser tests passed. Client build/lint, server typecheck, and Git diff checks passed. Browser tests use deterministic model responses; live Gemini streaming was checked separately.

**Pitfalls:** missing `flushHeaders`; proxies buffering; forgetting the blank line (`\n\n`) between events; mutating state instead of copying; parsing a half-received event.
**Commit:** `feat: stream chat responses with SSE and stop button`

---

# PHASE 2: Documents and retrieval

## Task 5: PDF upload + text extraction [DONE]

**Goal:** Upload a PDF and extract text per page on the server.

**You will learn:** file uploads (`multipart/form-data`), memory storage, PDF parsing, file validation.

**Steps**
1. `npm install multer` and `npm install -D @types/multer` in `server/`.
2. Install one PDF text-extraction library that returns text per page (check npm for a maintained one; `pdfjs-dist` or `pdf-parse` are common choices). Tell the developer which one you chose and why.
3. Create `routes/documents.ts` with `POST /api/documents`: multer `memoryStorage`, field name `file`, limit 5 MB, accept only `application/pdf`.
4. Create `services/pdf.ts` exporting `extractPages(buffer): Promise<{ page: number; text: string }[]>`.
5. For now just `console.log` the page count and the first 200 characters of page 1. Return `{ name, pages }` JSON.
6. Client: simple `UploadBox` component (file input, accept `.pdf`), shows uploading / success / error.

**Write it yourself:** `extractPages` and validation.
**Agent can do this:** multer config, UploadBox UI.

**Agent prompt:** "Implement Task 5 per ROADMAP.md: PDF upload with multer (memory storage, 5MB, pdf only) and a services/pdf.ts extractPages function returning text per page. Log results; do not touch the database yet."

**Done when**
- [x] Uploading a text PDF logs correct text and page count
- [x] A non-PDF or >5MB file returns a clear 400 error shown in the UI
- [x] A scanned (image-only) PDF returns an "no text found" message instead of crashing

Implementation: `multer` receives one PDF in memory with a 5 MB limit. `pdf-parse` extracts typed `{ page, text }` results and releases parser resources in `finally`. The route checks MIME type and PDF content, reports invalid/corrupted or image-only files clearly, logs the page count and first 200 characters of page 1, and returns `{ name, pages }`. UploadBox displays progress, success, and server/network errors. Files are not persisted or used by chat yet; no OCR or database work is included.

Agent-run validation (2026-10-06): 14 server tests and 14 client tests passed; all 12 Edge browser checks passed, including six new upload checks through the real document route/parser. Generated real PDF fixtures cover text on multiple pages, mixed image/text pages, and image-only pages. Route tests verify the logged preview and HTTP 400 responses. Client build/lint, server typecheck, and Git diff checks passed. These are automated agent checks; developer manual acceptance has not been claimed. Task 6 is next.

**Commit:** `feat: add PDF upload and per-page text extraction`

---

## Task 6: Chunking

**Goal:** Turn page text into small overlapping chunks that keep their page number.

**You will learn:** why chunking exists (embedding and context limits), chunk size and overlap tradeoffs.

**Steps**
1. Create `services/chunker.ts`: `chunkPages(pages, { size = 800, overlap = 150 }): Chunk[]` where `Chunk = { page, chunkIndex, text }`.
2. Split each page's text (clean extra whitespace first). Prefer to cut at sentence or paragraph boundaries when possible; otherwise cut by characters.
3. Skip empty or tiny chunks (< 30 characters).
4. Log the number of chunks and print 2 sample chunks.
5. Write 3 tiny tests (or a script) with fake text: short text gives 1 chunk; long text gives overlapping chunks; empty gives none.

**Write it yourself:** the whole chunker (this teaches chunk size and overlap).
**Agent can do this:** write the tests, suggest improvements.

**Done when:**
- [ ] A real PDF becomes a list of chunks, each with page and index
- [ ] Neighboring chunks share ~overlap characters
- [ ] No chunk is empty

**Commit:** `feat: add text chunking with overlap`

---

## Task 7: Embeddings + MongoDB storage

**Goal:** Create an embedding for every chunk and store everything in Atlas.

**You will learn:** what embeddings are (text as a vector of numbers where similar meaning means close vectors), batching, MongoDB driver basics.

**Steps**
1. Create a free MongoDB Atlas M0 cluster. Create a database user. Allow your IP (and later `0.0.0.0/0` for Render, with a strong password). Put the URI in `.env` as `MONGODB_URI`.
2. `npm install mongodb` in `server/`. Create `db/mongo.ts` with a single reused client and `getDb()`.
3. Create `services/embeddings.ts`: `embedTexts(texts: string[]): Promise<number[][]>` using the Gemini embedding model from `GEMINI_EMBEDDING_MODEL`. Set output dimensionality to `EMBEDDING_DIMENSIONS` if the API supports it. Batch requests (for example 20 chunks per call) and respect rate limits (small delay, retry on 429/503).
4. In the upload route: after chunking, embed all chunks, insert one `documents` record, then insert `chunks` records (with `embedding`, `documentId`, `sessionId`, `documentName`, `page`).
5. `sessionId` comes from the client (`useSessionId` hook: generate a UUID, save in `localStorage`, send with requests).
6. Check the data in Atlas "Browse Collections".

**Write it yourself:** `embedTexts` batching logic and the insert.
**Agent can do this:** Mongo connection boilerplate, `useSessionId` hook.

**Done when**
- [ ] After upload, `documents` has 1 record and `chunks` has N records with embeddings
- [ ] Every embedding has the same length (matches `EMBEDDING_DIMENSIONS`)
- [ ] Uploading a large PDF does not crash on rate limits (retries or clear error)

**Pitfalls:** never commit the connection string; do not open a new Mongo connection per request; mismatched vector length breaks Task 8.
**Commit:** `feat: embed chunks and store them in MongoDB`

---

## Task 8: Vector search

**Goal:** Given a question, return the most relevant chunks.

**You will learn:** vector indexes, cosine similarity, `$vectorSearch`, top-k tuning.

**Steps**
1. In Atlas, create a Vector Search index on `chunks` named `chunk_vector_index`. Use JSON like this, with `numDimensions` equal to your embedding length:
   ```json
   {
     "fields": [
       { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
       { "type": "filter", "path": "sessionId" },
       { "type": "filter", "path": "documentId" }
     ]
   }
   ```
2. Create `services/retrieval.ts`: `searchChunks(question, { sessionId, documentIds?, k = 5 })`.
3. Embed the question with the SAME embedding model, then run an aggregation:
   ```
   { $vectorSearch: { index: "chunk_vector_index", path: "embedding", queryVector,
       numCandidates: 100, limit: k, filter: { sessionId } } }
   { $project: { text: 1, page: 1, documentName: 1, score: { $meta: "vectorSearchScore" } } }
   ```
4. Add a temporary `GET /api/debug/search?q=...&sessionId=...` route to inspect results. Remove it before deploying.
5. Experiment: try 5 questions and read the returned chunks and scores.

**Write it yourself:** the search function and the question tests.
**Agent can do this:** helping with index JSON syntax (verify against Atlas docs).

**Done when**
- [ ] Questions about the PDF return chunks that clearly contain the answer
- [ ] Results only include the current session's chunks
- [ ] You can say what `numCandidates`, `limit` and score mean

**Pitfalls:** the index takes a minute to build; filter fields must be declared as `filter` in the index; question and chunks must use the same model and dimensions.
**Commit:** `feat: add vector search retrieval`

---

## Task 9: Connect retrieval to chat (the RAG step)

**Goal:** Answers are grounded in retrieved chunks.

**You will learn:** prompt construction, grounding, refusing when there is no context.

**Steps**
1. Refactor: move Gemini logic to `services/llm.ts` (`streamAnswer(prompt)`), and routes to `routes/chat.ts`. Keep `index.ts` for setup only.
2. `/api/chat` now receives `{ message, sessionId }`. Flow: retrieve top-k chunks, build prompt, stream the answer.
3. Prompt template (put in `services/prompt.ts`):
   ```
   You are a document assistant. Answer ONLY using the context below.
   If the answer is not in the context, say: "I couldn't find that in your documents."
   Be concise. Do not invent facts.

   Context:
   [1] (file: {documentName}, page {page}) {text}
   [2] ...

   Question: {message}
   ```
4. If retrieval returns no chunks (or the best score is below a threshold you choose), skip the LLM and stream the fallback message.
5. Test off-topic questions, they must be refused.

**Write it yourself:** the prompt builder and the "no context" logic.
**Agent can do this:** the refactor into files.

**Agent prompt:** "Implement Task 9 per ROADMAP.md. First refactor server/src/index.ts into routes/ and services/ without changing behavior, then add retrieval into the chat route. Keep streaming working."

**Done when**
- [ ] Questions about the PDF are answered correctly and stream in
- [ ] Off-topic questions get the fallback message
- [ ] Chat still works after the refactor

**Commit:** `feat: add RAG to chat with grounded prompt`

---

# PHASE 3: Make it trustworthy

## Task 10: Citations

**Goal:** Every answer shows where it came from.

**Steps**
1. Server: send a `{ type: "sources", sources }` SSE event with `{ documentName, page, snippet (first ~200 chars), score }` for the chunks used.
2. Ask the model to mention sources as [1], [2] in its answer (add this to the prompt).
3. Client: store `sources` on the assistant message. Create `SourcesPanel`: collapsible list under each answer showing document, page, and snippet. Clicking `[1]` in the answer highlights the matching source (nice to have).

**Done when:** each answer has a Sources panel with correct document and page; an answer with no context shows none.
**Commit:** `feat: show source citations for answers`

---

## Task 11: Multiple documents + session separation

**Goal:** Manage several documents, and keep each user's data private.

**Steps**
1. Server: `GET /api/documents?sessionId=` and `DELETE /api/documents/:id?sessionId=` (delete the document AND its chunks; verify `sessionId` matches).
2. Client: `DocumentList` with name, pages, delete button. Optionally checkboxes to choose which documents to search (`documentIds` filter in `$vectorSearch`).
3. Security basics: every query must filter by `sessionId`. Never trust ids alone.
4. Limits: max documents per session (e.g. 5) and max total chunks, to protect the free Atlas tier.

**Done when:** two browsers (or incognito) cannot see each other's documents; deleting removes chunks from Atlas.
**Commit:** `feat: manage multiple documents with per-session isolation`

---

## Task 12: Error handling + edge cases

**Goal:** Nothing crashes; every failure has a clear message.

**Cases to handle**
- Gemini 429/503 (use Task 2b helpers, also for embeddings), network failure
- Empty message, extremely long message (limit length)
- Scanned PDF with no text, corrupted PDF, password-protected PDF, huge PDF
- Atlas connection failure
- Client aborts mid-stream
- Basic rate limit per session/IP on the server (simple in-memory counter is fine)

**Steps**
1. Create `utils/errors.ts` with an `AppError(status, message)` class and an Express error middleware.
2. Validate inputs (type, length) at the start of each route.
3. Client: map error responses to friendly messages; add a "Retry" button on failures.

**Done when:** you can deliberately trigger each case above and the UI always recovers.
**Commit:** `fix: handle errors and edge cases`

---

## Task 13: Evaluation (this makes the project stand out)

**Goal:** Measure answer quality with numbers.

**Steps**
1. Pick a public sample document (for example a public report or manual, never private data).
2. Write 15 to 20 questions in `server/eval/questions.json`: `{ question, expectedAnswerContains: string[], expectedPage?: number }`. Include 3 questions that are NOT in the document (the correct behavior is refusal).
3. Write `server/eval/run.ts`: for each question, call the retrieval and answer functions directly (not over HTTP), then check:
   - **Retrieval hit:** did the top-k include the expected page?
   - **Answer check:** does the answer contain the expected keywords?
   - **Refusal check:** for out-of-scope questions, did it refuse?
4. Print a table: totals and percentages.
5. Experiment: change chunk size (500, 800, 1200), overlap, and k (3, 5, 8). Record results in `eval/RESULTS.md`.

**Done when:** you have a results table, e.g. "Retrieval hit rate 85%, answer accuracy 80%, refusal accuracy 3/3 (chunk size 800, k=5)".
**Commit:** `feat: add evaluation script and results`

---

# PHASE 4: Polish and ship

## Task 14: UI polish
- Responsive layout (mobile and desktop)
- Render answers as Markdown (a small library such as `react-markdown` is fine)
- Copy button, empty states ("Upload a PDF to start"), disabled input until a document exists
- Accessible: labels, keyboard use, focus states
- Optional: dark mode
**Commit:** `feat: polish UI`

## Task 15: Deploy
1. **MongoDB Atlas:** allow Render to connect (network access list). Use a strong DB password.
2. **Server on Render:** build with `npm run build` (add a `tsc` build to `package.json`; `main` then points to `dist/index.js`) and start with `node dist/index.js`. Set all env vars in Render. Set `CLIENT_ORIGIN` to the Vercel URL and restrict CORS to it.
3. **Client on Vercel:** set `VITE_API_URL` to the Render URL.
4. Render free tier sleeps: add `GET /api/health`, and on the client show "Waking up the server, this can take ~30 seconds" if the first request is slow.
5. Remove debug routes. Check logs do not print secrets. Make sure `.env` was never committed.
**Done when:** a friend can open the public link and use the app end to end.
**Commit:** `chore: configure production deployment`

## Task 16: README + demo
README must include: one-line description, screenshot or GIF, live demo link, features, architecture diagram (use the one in this file), tech stack, setup steps (env vars, Atlas index JSON), evaluation results table, "What I learned", "Limitations and next steps". Make the repo public after checking no secrets exist in git history.

## Task 17: CV + LinkedIn
Example line:
"Built and deployed a RAG-based document Q&A app (React, TypeScript, Node.js, MongoDB Vector Search, Gemini) with streaming responses, source citations, and a custom evaluation set (xx% retrieval accuracy)."
Add the live link and GitHub link. Prepare to explain: chunking, embeddings, vector search, SSE streaming, evaluation, and the problems you solved (rate limits, model deprecations).

---

## Stretch tasks (only after Task 17)
1. Tool calling: add tools like `summarize_document` or `list_key_dates` and let the model call them.
2. Login with JWT so users keep documents between visits.
3. Rebuild the client in Vue 3 (useful for Vue-focused job listings).
4. Conversation memory: send recent messages with each question; rewrite follow-up questions before retrieval.
5. Hybrid search (keyword + vector) and re-ranking.
6. Support DOCX and TXT uploads.

---

## Interview cheat sheet (be able to explain these)
- What is RAG and why use it instead of pasting the whole document?
- What is an embedding? Why must the question and chunks use the same model?
- Why chunk, and how do chunk size and overlap affect quality?
- How does SSE streaming work, and why not `EventSource`?
- How do you stop hallucinations? (grounded prompt, refusal, citations, evaluation)
- How did you handle rate limits and model outages? (retry, backoff, fallback)
- How do you keep users' data separate? (sessionId filter on every query)
- How did you measure quality? (eval set, retrieval hit rate)

## Daily workflow checklist
1. `git pull`, read the current task here.
2. Write the core part yourself, ask the agent for review or boilerplate.
3. Run both servers (`server`: `npm run dev`, `client`: `npm run dev`) and test the "Done when" list.
4. Check `git status` (no `.env`), commit with the suggested message, push.
5. Tick the Status Tracker and update the "Current status" line in `AGENTS.md`.
