import { GoogleGenAI } from "@google/genai";
import { generateWithRetry } from "./generateWithRetry.js";

export type AnswerChunk = { text?: string };
export type AnswerStream = AsyncIterable<AnswerChunk>;

let ai: GoogleGenAI | undefined;

export async function streamAnswer(prompt: string, signal: AbortSignal): Promise<AnswerStream> {
  const model = process.env.GEMINI_MODEL?.trim();
  if (!model) throw new Error("GEMINI_MODEL must be configured in server/.env.");
  const models = [model, process.env.GEMINI_FALLBACK_MODEL?.trim() ?? ""];
  ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return generateWithRetry(
    (candidate) => ai!.models.generateContentStream({
      model: candidate,
      contents: prompt,
      config: { abortSignal: signal },
    }),
    { models, signal },
  );
}
