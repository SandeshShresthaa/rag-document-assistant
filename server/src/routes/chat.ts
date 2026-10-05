import type { RequestHandler } from "express";
import { busyMessage, isBusyError } from "../services/generateWithRetry.js";

export function createChatHandler(generate: (message: string) => Promise<string | undefined>): RequestHandler {
  return async (req, res) => {
    const body: unknown = req.body;
    if (typeof body !== "object" || body === null || !("message" in body) ||
      typeof body.message !== "string" || !body.message.trim()) {
      res.status(400).json({ error: "A non-empty message is required" });
      return;
    }
    try {
      const reply = await generate(body.message.trim());
      if (!reply?.trim()) throw new Error("Empty answer");
      res.json({ reply });
    } catch (error) {
      res.status(isBusyError(error) ? 503 : 500).json({
        error: isBusyError(error) ? busyMessage : "Unable to get an answer. Please try again.",
      });
    }
  };
}
