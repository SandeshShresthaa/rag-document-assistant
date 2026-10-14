import assert from "node:assert/strict";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import express from "express";
import { createChatHandler } from "./chat.js";
import { MIN_RETRIEVAL_SCORE, NO_CONTEXT_MESSAGE } from "../services/prompt.js";
import type { SearchResult } from "../services/retrieval.js";

const sessionId = "123e4567-e89b-42d3-a456-426614174000";
const source: SearchResult = {
  documentId: "507f1f77bcf86cd799439011", documentName: "guide.pdf",
  page: 2, chunkIndex: 0, text: "MongoDB stores document chunks.", score: 0.91,
};

async function withServer(
  dependencies: Parameters<typeof createChatHandler>[0],
  check: (url: string) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  app.post("/api/chat", createChatHandler(dependencies));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try { await check(`http://127.0.0.1:${address.port}/api/chat`); }
  finally {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
}

function post(url: string, body: unknown, signal?: AbortSignal) {
  return fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal,
  });
}

test("retrieves context, builds a grounded prompt and streams the answer", async () => {
  let retrieval: unknown;
  let prompt = "";
  await withServer({
    retrieve: async (question, options) => { retrieval = { question, options }; return [source]; },
    answer: async (received) => {
      prompt = received;
      return (async function* () { yield {}; yield { text: "Stored " }; yield { text: "in MongoDB." }; })();
    },
  }, async (url) => {
    const response = await post(url, { message: " What is stored? ", sessionId,
      documentIds: [source.documentId] });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
    assert.equal(await response.text(),
      'data: {"type":"token","text":"Stored "}\n\ndata: {"type":"token","text":"in MongoDB."}\n\ndata: [DONE]\n\n');
  });
  assert.deepEqual(retrieval, { question: "What is stored?", options: {
    sessionId, documentIds: [source.documentId],
  } });
  assert.match(prompt, /Answer ONLY using the context/);
  assert.match(prompt, /\[1\] \(file: guide\.pdf, page 2\) MongoDB stores document chunks\./);
  assert.match(prompt, /Question: What is stored\?$/);
});

test("empty or low-score retrieval streams the refusal without calling the LLM", async () => {
  for (const chunks of [[], [{ ...source, score: MIN_RETRIEVAL_SCORE - 0.01 }]]) {
    await withServer({
      retrieve: async () => chunks,
      answer: async () => { throw new Error("LLM must not be called"); },
    }, async (url) => {
      const response = await post(url, { message: "off topic", sessionId });
      assert.equal(await response.text(),
        `data: ${JSON.stringify({ type: "token", text: NO_CONTEXT_MESSAGE })}\n\ndata: [DONE]\n\n`);
    });
  }
});

test("validates the complete RAG request before starting SSE", async () => {
  await withServer({
    retrieve: async () => { throw new Error("must not retrieve"); },
    answer: async () => { throw new Error("must not answer"); },
  }, async (url) => {
    const cases = [
      [{ sessionId }, "A non-empty message is required."],
      [{ message: "hello", sessionId: "bad" }, "A valid sessionId is required."],
      [{ message: "hello", sessionId, documentIds: ["bad"] }, "documentIds must be an array of valid MongoDB IDs."],
    ] as const;
    for (const [body, message] of cases) {
      const response = await post(url, body);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: message });
    }
  });
});

test("retrieval and mid-stream failures send safe errors and DONE", async () => {
  for (const failure of ["retrieval", "stream"] as const) {
    await withServer({
      retrieve: async () => {
        if (failure === "retrieval") throw new Error("private database details");
        return [source];
      },
      answer: async () => (async function* () {
        yield { text: "partial" };
        throw new Error("private model details");
      })(),
    }, async (url) => {
      const response = await post(url, { message: "hello", sessionId });
      const events = (await response.text()).trim().split("\n\n");
      assert.equal(events.pop(), "data: [DONE]");
      assert.deepEqual(JSON.parse(events.pop()!.slice(6)), {
        type: "error", message: "Unable to finish the answer. Please try again.",
      });
      assert.equal(events.length, failure === "stream" ? 1 : 0);
    });
  }
});

test("disconnect aborts the LLM stream and a subsequent request succeeds", { timeout: 5000 }, async () => {
  let aborted = false;
  let calls = 0;
  await withServer({
    retrieve: async () => [source],
    answer: async (_prompt, signal) => {
      const first = ++calls === 1;
      return (async function* () {
        yield { text: "hello" };
        if (first) {
          try { await delay(10000, undefined, { signal }); }
          catch { aborted = signal.aborted; throw new Error("aborted"); }
        }
      })();
    },
  }, async (url) => {
    const controller = new AbortController();
    const response = await post(url, { message: "hello", sessionId }, controller.signal);
    await response.body!.getReader().read();
    controller.abort();
    for (let i = 0; i < 100 && !aborted; i++) await delay(10);
    assert.equal(aborted, true);
    const next = await post(url, { message: "again", sessionId });
    assert.match(await next.text(), /data: \[DONE\]\n\n$/);
  });
});
