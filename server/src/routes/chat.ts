import type { RequestHandler } from "express";
import { ObjectId } from "mongodb";
import { busyMessage, isBusyError } from "../services/generateWithRetry.js";
import { streamAnswer, type AnswerStream } from "../services/llm.js";
import { buildPrompt, MIN_RETRIEVAL_SCORE, NO_CONTEXT_MESSAGE } from "../services/prompt.js";
import { searchChunks, type SearchOptions, type SearchResult } from "../services/retrieval.js";
import { AppError } from "../utils/errors.js";

type ChatDependencies = {
  retrieve: (question: string, options: SearchOptions) => Promise<SearchResult[]>;
  answer: (prompt: string, signal: AbortSignal) => Promise<AnswerStream>;
};

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_MESSAGE_LENGTH = 2_000;

function sendToken(res: Parameters<RequestHandler>[1], text: string) {
  res.write(`data: ${JSON.stringify({ type: "token", text })}\n\n`);
}

function createSnippet(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= 200 ? normalized : `${normalized.slice(0, 197).trimEnd()}...`;
}

function sendSources(res: Parameters<RequestHandler>[1], chunks: SearchResult[]) {
  res.write(`data: ${JSON.stringify({
    type: "sources",
    sources: chunks.map((chunk) => ({
      documentName: chunk.documentName,
      page: chunk.page,
      snippet: createSnippet(chunk.text),
      score: chunk.score,
    })),
  })}\n\n`);
}

export function createChatHandler(
  dependencies: ChatDependencies = { retrieve: searchChunks, answer: streamAnswer },
): RequestHandler {
  return async (req, res, next) => {
    const body: unknown = req.body;
    if (typeof body !== "object" || body === null ||
      !("message" in body) || typeof body.message !== "string" || !body.message.trim()) {
      next(new AppError(400, "A non-empty message is required."));
      return;
    }
    if (body.message.trim().length > MAX_MESSAGE_LENGTH) {
      next(new AppError(400, `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.`));
      return;
    }
    if (!("sessionId" in body) || typeof body.sessionId !== "string" ||
      !SESSION_ID_PATTERN.test(body.sessionId)) {
      next(new AppError(400, "A valid sessionId is required."));
      return;
    }
    const documentIds = "documentIds" in body ? body.documentIds : undefined;
    if (documentIds !== undefined && (!Array.isArray(documentIds) ||
      documentIds.some((id) => typeof id !== "string" || !ObjectId.isValid(id)))) {
      next(new AppError(400, "documentIds must be an array of valid MongoDB IDs."));
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
        sendSources(res, chunks);
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
