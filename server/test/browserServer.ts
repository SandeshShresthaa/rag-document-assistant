// Local test fixture only: the real SSE handler with a deterministic fake model.
import express from "express";
import cors from "cors";
import { setTimeout as delay } from "node:timers/promises";
import { GenerateContentResponse } from "@google/genai";
import { createChatStreamHandler } from "../src/routes/chatStream.js";
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
app.post("/api/chat/stream", createChatStreamHandler(async (params) => {
  started++;
  return (async function* () {
    const signal = params.config?.abortSignal;
    try {
      await delay(params.contents === "delayed" ? 10000 : 300, undefined, { signal });
      const first = new GenerateContentResponse();
      first.candidates = [{ content: { parts: [{ text: "First chunk." }] } }];
      yield first;
      await delay(params.contents === "slow" ? 10000 : 800, undefined, { signal });
      if (params.contents === "error") throw new Error("simulated failure");
      const second = new GenerateContentResponse();
      second.candidates = [{ content: { parts: [{ text: " Final chunk." }] } }];
      yield second;
    } catch (error) {
      if (signal?.aborted) aborted++;
      throw error;
    }
  })();
}, "test-model"));
app.listen(5051, "127.0.0.1");
