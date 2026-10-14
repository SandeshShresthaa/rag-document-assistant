import type { RequestHandler } from "express";
import { ObjectId } from "mongodb";
import { busyMessage, isBusyError } from "../services/generateWithRetry.js";
import { streamAnswer, type AnswerStream } from "../services/llm.js";
import { buildPrompt, MIN_RETRIEVAL_SCORE, NO_CONTEXT_MESSAGE } from "../services/prompt.js";
import { searchChunks, type SearchOptions, type SearchResult } from "../services/retrieval.js";

type ChatDependencies = {
  retrieve: (question: string, options: SearchOptions) => Promise<SearchResult[]>;
  answer: (prompt: string, signal: AbortSignal) => Promise<AnswerStream>;
};

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendToken(res: Parameters<RequestHandler>[1], text: string) {
  res.write(`data: ${JSON.stringify({ type: "token", text })}\n\n`);
}

export function createChatHandler(
  dependencies: ChatDependencies = { retrieve: searchChunks, answer: streamAnswer },
): RequestHandler {
  return async (req, res) => {
    const body: unknown = req.body;
    if (typeof body !== "object" || body === null ||
      !("message" in body) || typeof body.message !== "string" || !body.message.trim()) {
      res.status(400).json({ error: "A non-empty message is required." });
      return;
    }
    if (!("sessionId" in body) || typeof body.sessionId !== "string" ||
      !SESSION_ID_PATTERN.test(body.sessionId)) {
      res.status(400).json({ error: "A valid sessionId is required." });
      return;
    }
    const documentIds = "documentIds" in body ? body.documentIds : undefined;
    if (documentIds !== undefined && (!Array.isArray(documentIds) ||
      documentIds.some((id) => typeof id !== "string" || !ObjectId.isValid(id)))) {
      res.status(400).json({ error: "documentIds must be an array of valid MongoDB IDs." });
      return;
    }

    const controller = new AbortController();
    const onClose = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.on("close", onClose);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      const question = body.message.trim();
      const chunks = await dependencies.retrieve(question, {
        sessionId: body.sessionId,
        documentIds: documentIds as string[] | undefined,
      });
      if (!chunks.length || chunks[0].score < MIN_RETRIEVAL_SCORE) {
        sendToken(res, NO_CONTEXT_MESSAGE);
      } else {
        const stream = await dependencies.answer(buildPrompt(question, chunks), controller.signal);
        for await (const chunk of stream) {
          if (controller.signal.aborted || res.destroyed) break;
          if (chunk.text) sendToken(res, chunk.text);
        }
      }
    } catch (error) {
      if (!controller.signal.aborted && !res.destroyed) {
        res.write(`data: ${JSON.stringify({
          type: "error",
          message: isBusyError(error) ? busyMessage : "Unable to finish the answer. Please try again.",
        })}\n\n`);
      }
    } finally {
      if (!controller.signal.aborted && !res.destroyed) {
        res.write("data: [DONE]\n\n");
        res.end();
      }
      res.off("close", onClose);
    }
  };
}
