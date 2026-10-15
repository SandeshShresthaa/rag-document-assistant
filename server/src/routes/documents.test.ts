import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { createDocumentsRouter, MAX_PDF_BYTES } from "./documents.js";
import { makePdf } from "../../test/pdfFixture.js";
import { errorHandler } from "../utils/errors.js";

const validSessionId = "123e4567-e89b-42d3-a456-426614174000";

async function withServer(router: ReturnType<typeof createDocumentsRouter>, check: (url: string) => Promise<void>) {
  const app = express();
  app.use("/api/documents", router);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await check(`http://127.0.0.1:${address.port}/api/documents`);
  } finally {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
}

function uploadBody(data?: Buffer, type = "application/pdf", field = "file", sessionId = validSessionId) {
  const body = new FormData();
  if (data) body.append(field, new Blob([new Uint8Array(data)], { type }), "sample.pdf");
  body.append("sessionId", sessionId);
  return body;
}

test("extracts, chunks, embeds and stores a real multipart PDF", async () => {
  const stored: unknown[] = [];
  const router = createDocumentsRouter({
    usage: async () => ({ documents: 0, chunks: 0 }),
    embed: async (texts) => texts.map((_, index) => [index, 1, 2]),
    store: async (document) => { stored.push(document); return "507f1f77bcf86cd799439011"; },
  });
  await withServer(router, async (url) => {
    const response = await fetch(url, { method: "POST", body: uploadBody(makePdf([
      "First page has enough text for a useful chunk.",
      "Second page has text for another chunk.",
    ])) });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      documentId: "507f1f77bcf86cd799439011", name: "sample.pdf", pages: 2, chunks: 2,
    });
  });
  assert.deepEqual(stored, [{
    sessionId: validSessionId,
    name: "sample.pdf",
    pages: 2,
    chunks: [
      { page: 1, chunkIndex: 0, text: "First page has enough text for a useful chunk." },
      { page: 2, chunkIndex: 1, text: "Second page has text for another chunk." },
    ],
    embeddings: [[0, 1, 2], [1, 1, 2]],
  }]);
});

test("returns clear validation errors without embedding invalid uploads", async () => {
  let embedCalls = 0;
  const router = createDocumentsRouter({
    usage: async () => ({ documents: 0, chunks: 0 }),
    embed: async () => { embedCalls++; return []; },
    store: async () => "unused",
  });
  await withServer(router, async (url) => {
    const cases = [
      { body: uploadBody(Buffer.from("hello"), "text/plain"), error: /Only PDF/ },
      { body: uploadBody(Buffer.from("fake")), error: /not a valid PDF/ },
      { body: uploadBody(Buffer.alloc(MAX_PDF_BYTES + 1)), error: /5 MB/ },
      { body: uploadBody(makePdf([null])), error: /No text found/ },
      { body: uploadBody(Buffer.from("%PDF-1.4\nbroken")), error: /corrupted/ },
      { body: uploadBody(makePdf(["test"]), "application/pdf", "wrong"), error: /file field/ },
      { body: uploadBody(undefined), error: /Choose a PDF/ },
      { body: uploadBody(makePdf(["Enough text to pass chunk validation."]), "application/pdf", "file", "invalid"), error: /valid sessionId/ },
      { body: uploadBody(makePdf(["tiny"])), error: /enough text/ },
    ];
    for (const item of cases) {
      const response = await fetch(url, { method: "POST", body: item.body });
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, item.error);
    }
  });
  assert.equal(embedCalls, 0);
});

test("reports embedding and storage failures without leaking details", async () => {
  for (const failure of ["embed", "store"] as const) {
    const router = createDocumentsRouter({
      usage: async () => ({ documents: 0, chunks: 0 }),
      embed: async (texts) => {
        if (failure === "embed") throw new Error("private embedding failure");
        return texts.map(() => [1]);
      },
      store: async () => {
        if (failure === "store") throw new Error("private database failure");
        return "unused";
      },
    });
    await withServer(router, async (url) => {
      const response = await fetch(url, { method: "POST", body: uploadBody(makePdf([
        "Enough searchable document text for a chunk.",
      ])) });
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: "Unable to save the PDF. Please try again." });
    });
  }
});

test("maps exhausted embedding capacity to the friendly busy response", async () => {
  const router = createDocumentsRouter({
    usage: async () => ({ documents: 0, chunks: 0 }),
    embed: async () => { throw { status: 503 }; },
  });
  await withServer(router, async (url) => {
    const response = await fetch(url, { method: "POST", body: uploadBody(makePdf([
      "Enough searchable document text for a chunk.",
    ])) });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "The AI model is busy. Please try again in a moment.",
    });
  });
});

test("lists and deletes documents only through the matching session", async () => {
  const otherSession = "223e4567-e89b-42d3-a456-426614174000";
  const documentId = "507f1f77bcf86cd799439011";
  const listCalls: string[] = [];
  const removeCalls: Array<{ documentId: string; sessionId: string }> = [];
  const router = createDocumentsRouter({
    list: async (sessionId) => {
      listCalls.push(sessionId);
      return sessionId === validSessionId ? [{
        documentId, name: "owned.pdf", pages: 2, chunks: 3, createdAt: "2026-10-14T00:00:00.000Z",
      }] : [];
    },
    remove: async (id, sessionId) => {
      removeCalls.push({ documentId: id, sessionId });
      return id === documentId && sessionId === validSessionId;
    },
  });
  await withServer(router, async (url) => {
    const owned = await fetch(`${url}?sessionId=${validSessionId}`);
    assert.deepEqual(await owned.json(), { documents: [{
      documentId, name: "owned.pdf", pages: 2, chunks: 3, createdAt: "2026-10-14T00:00:00.000Z",
    }] });
    const isolated = await fetch(`${url}?sessionId=${otherSession}`);
    assert.deepEqual(await isolated.json(), { documents: [] });
    const forbiddenDelete = await fetch(`${url}/${documentId}?sessionId=${otherSession}`, { method: "DELETE" });
    assert.equal(forbiddenDelete.status, 404);
    const deleted = await fetch(`${url}/${documentId}?sessionId=${validSessionId}`, { method: "DELETE" });
    assert.equal(deleted.status, 204);
  });
  assert.deepEqual(listCalls, [validSessionId, otherSession]);
  assert.deepEqual(removeCalls, [
    { documentId, sessionId: otherSession },
    { documentId, sessionId: validSessionId },
  ]);
});

test("enforces document and chunk limits before embedding", async () => {
  let embedCalls = 0;
  for (const usage of [
    { documents: 5, chunks: 5, expected: /up to 5 documents/ },
    { documents: 1, chunks: 500, expected: /up to 500 document chunks/ },
  ]) {
    const router = createDocumentsRouter({
      usage: async () => usage,
      embed: async () => { embedCalls++; return []; },
    });
    await withServer(router, async (url) => {
      const response = await fetch(url, { method: "POST", body: uploadBody(makePdf([
        "Enough searchable document text for one chunk.",
      ])) });
      assert.equal(response.status, 409);
      assert.match((await response.json()).error, usage.expected);
    });
  }
  assert.equal(embedCalls, 0);
});
