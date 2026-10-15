import { chunkPages, type Chunk } from "../src/services/chunker.js";
import { NO_CONTEXT_MESSAGE } from "../src/services/prompt.js";
import type { SearchResult } from "../src/services/retrieval.js";

export type EvalQuestion = {
  question: string;
  expectedAnswerContains: string[];
  expectedPage?: number;
  outOfScope?: boolean;
};

export type EvalConfig = {
  chunkSize: number;
  overlap: number;
  k: number;
};

export type EvalResult = {
  question: string;
  retrievalHit?: boolean;
  answerCorrect?: boolean;
  refusalCorrect?: boolean;
  answer: string;
  pages: number[];
};

export type EvalSummary = {
  config: EvalConfig;
  total: number;
  grounded: number;
  outOfScope: number;
  retrievalHits: number;
  answerCorrect: number;
  refusalsCorrect: number;
  results: EvalResult[];
};

type Page = { page: number; text: string };
type Retrieve = (question: string, k: number) => Promise<SearchResult[]>;
type Answer = (question: string, chunks: SearchResult[]) => Promise<string>;

const STOP_WORDS = new Set([
  "a", "an", "and", "at", "did", "do", "for", "how", "in", "is", "of", "on",
  "the", "to", "was", "were", "what", "when", "where", "which", "who", "would",
]);

export async function evaluate(
  questions: EvalQuestion[],
  config: EvalConfig,
  retrieve: Retrieve,
  answer: Answer,
): Promise<EvalSummary> {
  const results: EvalResult[] = [];
  for (const item of questions) {
    const chunks = await retrieve(item.question, config.k);
    const response = chunks.length ? await answer(item.question, chunks) : NO_CONTEXT_MESSAGE;
    const normalizedAnswer = response.toLowerCase();
    results.push({
      question: item.question,
      retrievalHit: item.expectedPage === undefined
        ? undefined : chunks.some((chunk) => chunk.page === item.expectedPage),
      answerCorrect: item.outOfScope ? undefined
        : item.expectedAnswerContains.every((keyword) => normalizedAnswer.includes(keyword.toLowerCase())),
      refusalCorrect: item.outOfScope ? normalizedAnswer.includes(NO_CONTEXT_MESSAGE.toLowerCase()) : undefined,
      answer: response,
      pages: [...new Set(chunks.map((chunk) => chunk.page))],
    });
  }

  const grounded = questions.filter((item) => !item.outOfScope).length;
  const outOfScope = questions.length - grounded;
  return {
    config,
    total: questions.length,
    grounded,
    outOfScope,
    retrievalHits: results.filter((result) => result.retrievalHit).length,
    answerCorrect: results.filter((result) => result.answerCorrect).length,
    refusalsCorrect: results.filter((result) => result.refusalCorrect).length,
    results,
  };
}

export function createLocalRetriever(pages: Page[], config: EvalConfig): Retrieve {
  const chunks = chunkPages(pages, { size: config.chunkSize, overlap: config.overlap });
  return async (question, k) => {
    const questionTerms = terms(question);
    return chunks
      .map((chunk) => ({ chunk, score: lexicalScore(questionTerms, chunk) }))
      .filter((item) => item.score >= 0.5)
      .sort((left, right) => right.score - left.score)
      .slice(0, k)
      .map(({ chunk, score }) => toSearchResult(chunk, score));
  };
}

export async function extractiveAnswer(_question: string, chunks: SearchResult[]): Promise<string> {
  return chunks.map((chunk, index) => `${chunk.text} [${index + 1}]`).join("\n");
}

function terms(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term)));
}

function lexicalScore(questionTerms: Set<string>, chunk: Chunk): number {
  if (!questionTerms.size) return 0;
  const chunkTerms = terms(chunk.text);
  let matches = 0;
  for (const term of questionTerms) if (chunkTerms.has(term)) matches++;
  return matches / questionTerms.size;
}

function toSearchResult(chunk: Chunk, score: number): SearchResult {
  return {
    documentId: "000000000000000000000000",
    documentName: "Apollo_11_Press_Kit_excerpt.json",
    page: chunk.page,
    chunkIndex: chunk.chunkIndex,
    text: chunk.text,
    score,
  };
}
