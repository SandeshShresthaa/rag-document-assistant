// Local test fixture only: the real SSE handler with a deterministic fake model.
import express from "express";
import cors from "cors";
import { setTimeout as delay } from "node:timers/promises";
import { ObjectId } from "mongodb";
import { createChatHandler } from "../src/routes/chat.js";
import { createDocumentsRouter } from "../src/routes/documents.js";
import type { DocumentSummary } from "../src/db/documents.js";

const app = express();
app.use(cors());
app.use(express.json());
const browserDocuments = new Map<string, DocumentSummary[]>();
app.use("/api/documents", createDocumentsRouter({
  embed: async (texts) => texts.map(() => [0.1, 0.2, 0.3]),
  store: async (document) => {
    const documentId = new ObjectId().toHexString();
    const items = browserDocuments.get(document.sessionId) ?? [];
    items.unshift({
      documentId, name: document.name, pages: document.pages,
      chunks: document.chunks.length, createdAt: new Date().toISOString(),
    });
    browserDocuments.set(document.sessionId, items);
    return documentId;
  },
  list: async (sessionId) => browserDocuments.get(sessionId) ?? [],
  usage: async (sessionId) => {
    const items = browserDocuments.get(sessionId) ?? [];
    return { documents: items.length, chunks: items.reduce((sum, item) => sum + item.chunks, 0) };
  },
  remove: async (documentId, sessionId) => {
    const items = browserDocuments.get(sessionId) ?? [];
    const remaining = items.filter((item) => item.documentId !== documentId);
    if (remaining.length === items.length) return false;
    browserDocuments.set(sessionId, remaining);
    return true;
  },
}));
let aborted = 0;
let started = 0;
app.get("/test-state", (_req, res) => { res.json({ aborted, started }); });
app.post("/api/chat", createChatHandler({
  retrieve: async (question) => question === "off-topic" ? [] : [{
    documentId: "507f1f77bcf86cd799439011", documentName: "test.pdf", page: 1,
    chunkIndex: 0, text: "Test browser context.", score: 0.9,
  }],
  answer: async (prompt, signal) => {
    started++;
    const question = prompt.match(/Question: ([\s\S]*)$/)?.[1] ?? "";
    return (async function* () {
    try {
      await delay(question === "delayed" ? 10000 : 300, undefined, { signal });
      yield { text: question === "citation" ? "Answer from the document [1]." : "First chunk." };
      await delay(question === "slow" ? 10000 : 800, undefined, { signal });
      if (question === "error") throw new Error("simulated failure");
      if (question !== "citation") yield { text: " Final chunk." };
    } catch (error) {
      if (signal?.aborted) aborted++;
      throw error;
    }
    })();
  },
}));
app.listen(5051, "127.0.0.1");
