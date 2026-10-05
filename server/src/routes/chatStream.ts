import type { RequestHandler } from "express";
import type { Models } from "@google/genai";

// Passing the SDK function in lets us test streaming without API calls.
export function createChatStreamHandler(
  generateContentStream: Models["generateContentStream"],
  model: string,
): RequestHandler {
  return async (req, res) => {
    const body: unknown = req.body;
    if (
      typeof body !== "object" || body === null ||
      !("message" in body) || typeof body.message !== "string" ||
      !body.message.trim()
    ) {
      res.status(400).json({ error: "A non-empty message is required" });
      return;
    }

    const controller = new AbortController();
    const onClose = () => {
      if (!res.writableEnded) controller.abort();
    };
    // Request 'close' can mean the POST body finished, not a disconnect.
    res.on("close", onClose);

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      const stream = await generateContentStream({
        model,
        contents: body.message.trim(),
        config: { abortSignal: controller.signal },
      });

      for await (const chunk of stream) {
        if (controller.signal.aborted || res.destroyed) break;
        const text = chunk.text;
        if (text) {
          // A blank line marks the end of each SSE event.
          res.write(`data: ${JSON.stringify({ type: "token", text })}\n\n`);
        }
      }
    } catch {
      if (!controller.signal.aborted && !res.destroyed) {
        // Headers are already sent: report failure inside the stream.
        res.write(`data: ${JSON.stringify({
          type: "error",
          message: "Unable to finish the answer. Please try again.",
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
