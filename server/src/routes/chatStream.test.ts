import assert from "node:assert/strict";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import express from "express";
import { GenerateContentResponse, type Models } from "@google/genai";
import { createChatStreamHandler } from "./chatStream.js";

function chunk(text?: string) {
  const response = new GenerateContentResponse();
  if (text !== undefined) response.candidates = [{ content: { parts: [{ text }] } }];
  return response;
}

async function withServer(
  generate: Models["generateContentStream"],
  check: (url: string) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  app.post("/api/chat/stream", createChatStreamHandler(generate, "test-model"));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await check(`http://127.0.0.1:${address.port}/api/chat/stream`);
  } finally {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
}

function post(url: string, body: unknown, signal?: AbortSignal) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

test("streams a token before generation finishes, skips empty chunks, then DONE", { timeout: 5000 }, async () => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await withServer(async (params) => {
    assert.equal(params.model, "test-model");
    assert.equal(params.contents, "hello");
    return (async function* () {
      yield chunk();
      yield chunk('Hello\n"reader"');
      await gate;
      yield chunk("!");
    })();
  }, async (url) => {
    try {
      const response = await post(url, { message: " hello " });
      assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
      assert.equal(response.headers.get("cache-control"), "no-cache");
      assert.equal(response.headers.get("connection"), "keep-alive");
      const reader = response.body!.getReader();
      const first = await reader.read();
      const text = new TextDecoder().decode(first.value);
      assert.equal(text, `data: ${JSON.stringify({ type: "token", text: 'Hello\n"reader"' })}\n\n`);
      release();
      let rest = "";
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        rest += new TextDecoder().decode(next.value);
      }
      assert.equal(rest, 'data: {"type":"token","text":"!"}\n\ndata: [DONE]\n\n');
    } finally { release(); }
  });
});

test("invalid messages return JSON 400 without calling Gemini", async () => {
  await withServer(async () => { throw new Error("Must not call Gemini"); }, async (url) => {
    for (const body of [{}, { message: "  " }, { message: 42 }]) {
      const response = await post(url, body);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: "A non-empty message is required" });
    }
  });
});

test("startup and mid-stream failures send an error and DONE without leaking details", async () => {
  for (const midStream of [false, true]) {
    await withServer(async () => {
      if (!midStream) throw new Error("private upstream details");
      return (async function* () {
        yield chunk("partial");
        throw new Error("private upstream details");
      })();
    }, async (url) => {
      const response = await post(url, { message: "hello" });
      assert.equal(response.status, 200);
      const events = (await response.text()).trim().split("\n\n");
      assert.equal(events.pop(), "data: [DONE]");
      assert.deepEqual(JSON.parse(events.pop()!.slice(6)), {
        type: "error", message: "Unable to finish the answer. Please try again.",
      });
      assert.equal(events.length, midStream ? 1 : 0);
    });
  }
});

test("disconnect aborts the SDK request and a subsequent request succeeds", { timeout: 5000 }, async () => {
  let aborted = false;
  let calls = 0;
  await withServer(async (params) => {
    const first = ++calls === 1;
    return (async function* () {
      yield chunk("hello");
      if (first) {
        const signal = params.config!.abortSignal!;
        try { await delay(10000, undefined, { signal }); }
        catch { aborted = signal.aborted; throw new Error("aborted"); }
      }
    })();
  }, async (url) => {
    const controller = new AbortController();
    const response = await post(url, { message: "hello" }, controller.signal);
    await response.body!.getReader().read();
    controller.abort();
    for (let i = 0; i < 100 && !aborted; i++) await delay(10);
    assert.equal(aborted, true);
    const next = await post(url, { message: "again" });
    assert.match(await next.text(), /data: \[DONE\]\n\n$/);
  });
});
