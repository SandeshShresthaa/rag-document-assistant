import { GoogleGenAI, type EmbedContentResponse } from "@google/genai";
import { setTimeout as delay } from "node:timers/promises";
import { getEmbeddingConfig } from "../config.js";
import { generateWithRetry } from "./generateWithRetry.js";

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 100;

type EmbedContent = (params: {
  model: string;
  contents: { role: "user"; parts: { text: string }[] }[];
  config: { outputDimensionality: number; taskType: string };
}) => Promise<EmbedContentResponse>;

type EmbedOptions = {
  model: string;
  dimensions: number;
  batchSize?: number;
  taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
  waitBetweenBatches?: (milliseconds: number) => Promise<void>;
};

export function createEmbedTexts(embedContent: EmbedContent, options: EmbedOptions) {
  const batchSize = options.batchSize ?? BATCH_SIZE;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new RangeError("Embedding batch size must be a positive integer.");
  }

  return async (texts: string[]): Promise<number[][]> => {
    if (texts.some((text) => typeof text !== "string" || !text.trim())) {
      throw new Error("Embedding input must contain non-empty text.");
    }

    const result: number[][] = [];
    for (let start = 0; start < texts.length; start += batchSize) {
      const batch = texts.slice(start, start + batchSize);
      const response = await generateWithRetry(
        () => embedContent({
          model: options.model,
          // Separate Content objects produce one embedding per chunk.
          contents: batch.map((text) => ({ role: "user", parts: [{ text }] })),
          config: {
            outputDimensionality: options.dimensions,
            taskType: options.taskType ?? "RETRIEVAL_DOCUMENT",
          },
        }),
        { models: [options.model] },
      );
      const embeddings = response.embeddings ?? [];
      if (embeddings.length !== batch.length) {
        throw new Error("The embedding service returned an unexpected number of vectors.");
      }
      for (const embedding of embeddings) {
        const values = embedding.values;
        if (!values || values.length !== options.dimensions || values.some((value) => !Number.isFinite(value))) {
          throw new Error(`Every embedding must contain ${options.dimensions} finite numbers.`);
        }
        result.push(values);
      }
      if (start + batchSize < texts.length) {
        await (options.waitBetweenBatches ?? delay)(BATCH_DELAY_MS);
      }
    }
    return result;
  };
}

let defaultEmbedTexts: ((texts: string[]) => Promise<number[][]>) | undefined;
let defaultEmbedQuery: ((texts: string[]) => Promise<number[][]>) | undefined;

export function embedTexts(texts: string[]): Promise<number[][]> {
  if (!defaultEmbedTexts) {
    const config = getEmbeddingConfig();
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    defaultEmbedTexts = createEmbedTexts(
      (params) => ai.models.embedContent(params),
      config,
    );
  }
  return defaultEmbedTexts(texts);
}

export async function embedQuery(text: string): Promise<number[]> {
  if (!defaultEmbedQuery) {
    const config = getEmbeddingConfig();
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    defaultEmbedQuery = createEmbedTexts(
      (params) => ai.models.embedContent(params),
      { ...config, taskType: "RETRIEVAL_QUERY" },
    );
  }
  const [embedding] = await defaultEmbedQuery([text]);
  if (!embedding) throw new Error("The embedding service did not return a query vector.");
  return embedding;
}
