import "dotenv/config";
import express from "express";
import cors from "cors";
import { getClientOrigin } from "./config.js";
import { createChatHandler } from "./routes/chat.js";
import { documentsRouter } from "./routes/documents.js";
import { errorHandler } from "./utils/errors.js";
import { createRateLimiter } from "./utils/rateLimit.js";

const app = express();
app.use(cors({ origin: getClientOrigin() }));
app.use(express.json());
app.use("/api", createRateLimiter());
app.get("/api/health", (_req, res) => { res.json({ ok: true }); });
app.use("/api/documents", documentsRouter);

const chatHandler = createChatHandler();
app.post("/api/chat", chatHandler);
app.use(errorHandler);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
