import "dotenv/config";
import express from "express";
import cors from "cors";
import { createChatHandler } from "./routes/chat.js";
import { documentsRouter } from "./routes/documents.js";
import { debugSearchRouter } from "./routes/debugSearch.js";
import { errorHandler } from "./utils/errors.js";
import { createRateLimiter } from "./utils/rateLimit.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", createRateLimiter());
app.get("/api/health", (_req, res) => { res.json({ ok: true }); });
app.use("/api/documents", documentsRouter);
app.use("/api/debug", debugSearchRouter);

const chatHandler = createChatHandler();
app.post("/api/chat", chatHandler);
// Temporary compatibility alias for clients created before Task 9.
app.post("/api/chat/stream", chatHandler);
app.use(errorHandler);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
