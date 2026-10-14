// Local test fixture only: the real SSE handler with a deterministic fake model.
import express from "express";
import cors from "cors";
import { setTimeout as delay } from "node:timers/promises";
import { createChatHandler } from "../src/routes/chat.js";
import { createDocumentsRouter } from "../src/routes/documents.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/documents", createDocumentsRouter({
  embed: async (texts) => texts.map(() => [0.1, 0.2, 0.3]),
  store: async () => "507f1f77bcf86cd799439011",
}));
let aborted = 0;
let started = 0;
app.get("/test-state", (_req, res) => { res.json({ aborted, started }); });
app.post("/api/chat", createChatHandler({
  retrieve: async () => [{
    documentId: "507f1f77bcf86cd799439011", documentName: "test.pdf", page: 1,
    chunkIndex: 0, text: "Test browser context.", score: 0.9,
  }],
  answer: async (prompt, signal) => {
    started++;
    const question = prompt.match(/Question: ([\s\S]*)$/)?.[1] ?? "";
    return (async function* () {
    try {
      await delay(question === "delayed" ? 10000 : 300, undefined, { signal });
      yield { text: "First chunk." };
      await delay(question === "slow" ? 10000 : 800, undefined, { signal });
      if (question === "error") throw new Error("simulated failure");
      yield { text: " Final chunk." };
    } catch (error) {
      if (signal?.aborted) aborted++;
      throw error;
    }
    })();
  },
}));
app.listen(5051, "127.0.0.1");
