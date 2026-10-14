import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import { createChatHandler } from "./routes/chat.js";
import { createChatStreamHandler } from "./routes/chatStream.js";
import { generateWithRetry } from "./services/generateWithRetry.js";
import { documentsRouter } from "./routes/documents.js";
import { debugSearchRouter } from "./routes/debugSearch.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/documents", documentsRouter);
app.use("/api/debug", debugSearchRouter);

const model = process.env.GEMINI_MODEL?.trim();
if (!model) throw new Error("Set GEMINI_MODEL in server/.env before starting the server.");
const models = [model, process.env.GEMINI_FALLBACK_MODEL?.trim() ?? ""];
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post("/api/chat/stream", createChatStreamHandler(
  (params) => generateWithRetry(
    (candidate) => ai.models.generateContentStream({ ...params, model: candidate }),
    { models, signal: params.config?.abortSignal },
  ),
  model,
));

app.post("/api/chat", createChatHandler(async (message) => {
  const response = await generateWithRetry(
    (candidate) => ai.models.generateContent({ model: candidate, contents: message }),
    { models },
  );
  return response.text;
}));

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
