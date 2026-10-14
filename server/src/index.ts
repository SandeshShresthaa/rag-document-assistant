import "dotenv/config";
import express from "express";
import cors from "cors";
import { createChatHandler } from "./routes/chat.js";
import { documentsRouter } from "./routes/documents.js";
import { debugSearchRouter } from "./routes/debugSearch.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/documents", documentsRouter);
app.use("/api/debug", debugSearchRouter);

const chatHandler = createChatHandler();
app.post("/api/chat", chatHandler);
// Temporary compatibility alias for clients created before Task 9.
app.post("/api/chat/stream", chatHandler);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
