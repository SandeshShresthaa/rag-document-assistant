import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { createDebugSearchRouter } from "./debugSearch.js";
import { RetrievalValidationError } from "../services/retrieval.js";

const sessionId = "123e4567-e89b-42d3-a456-426614174000";

test("debug search returns results, forwards filters, and maps safe errors", async () => {
  const calls: unknown[] = [];
  const app = express();
  app.use("/api/debug", createDebugSearchRouter(async (question, options) => {
    calls.push({ question, options });
    if (question === "failure") throw new Error("private database details");
    if (!question) throw new RetrievalValidationError("A non-empty search question is required.");
    return [{ documentId: "507f1f77bcf86cd799439011", documentName: "guide.pdf", page: 1,
      chunkIndex: 0, text: "answer", score: 0.9 }];
  }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    const success = await fetch(`http://127.0.0.1:${address.port}/api/debug/search?` + new URLSearchParams({
      q: " stored data ", sessionId, documentIds: "507f1f77bcf86cd799439011", k: "3",
    }));
    assert.equal(success.status, 200);
    assert.equal((await success.json()).results[0].score, 0.9);
    assert.deepEqual(calls[0], { question: "stored data", options: {
      sessionId, documentIds: ["507f1f77bcf86cd799439011"], k: 3,
    } });

    const invalid = await fetch(`http://127.0.0.1:${address.port}/api/debug/search?sessionId=${sessionId}`);
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).error, /non-empty/);
    const failure = await fetch(`http://127.0.0.1:${address.port}/api/debug/search?` + new URLSearchParams({ q: "failure", sessionId }));
    assert.equal(failure.status, 500);
    assert.deepEqual(await failure.json(), { error: "Unable to search documents. Please try again." });
  } finally {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
});
