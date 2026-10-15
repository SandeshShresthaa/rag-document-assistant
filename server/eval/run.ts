import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { evaluate, createLocalRetriever, extractiveAnswer, type EvalConfig, type EvalQuestion } from "./evaluator.js";
import { buildPrompt, MIN_RETRIEVAL_SCORE } from "../src/services/prompt.js";
import { streamAnswer } from "../src/services/llm.js";
import { searchChunks, type SearchResult } from "../src/services/retrieval.js";

type SampleDocument = {
  title: string;
  source: string;
  pages: Array<{ page: number; text: string }>;
};

const configurations: EvalConfig[] = [
  { chunkSize: 500, overlap: 100, k: 3 },
  { chunkSize: 800, overlap: 150, k: 5 },
  { chunkSize: 1200, overlap: 200, k: 8 },
];

async function main() {
  const questions = parseQuestions(await readJson("questions.json"));
  const sample = parseSample(await readJson("sample-document.json"));
  const live = process.argv.includes("--live");

  console.log("Evaluation document: " + sample.title);
  console.log("Source: " + sample.source);
  console.log("Questions: " + questions.length + " (including " +
    questions.filter((item) => item.outOfScope).length + " out of scope)\n");

  if (live) {
    const sessionId = process.env.EVAL_SESSION_ID;
    if (!sessionId) throw new Error("Set EVAL_SESSION_ID to a session containing the evaluation document.");
    const config = configurations[1];
    const summary = await evaluate(
      questions,
      config,
      async (question, k) => {
        const chunks = await searchChunks(question, { sessionId, k });
        return chunks[0]?.score >= MIN_RETRIEVAL_SCORE ? chunks : [];
      },
      generateAnswer,
    );
    printTable([summary]);
    printFailures(summary.results);
    return;
  }

  const summaries = [];
  for (const config of configurations) {
    summaries.push(await evaluate(
      questions,
      config,
      createLocalRetriever(sample.pages, config),
      extractiveAnswer,
    ));
  }
  printTable(summaries);
  for (const summary of summaries) printFailures(summary.results, summary.config);
  console.log("\nLocal mode is deterministic and measures retrieval with extractive answers.");
  console.log("Set EVAL_SESSION_ID and run npm run eval -- --live to measure the configured Atlas/Gemini pipeline.");
}

async function generateAnswer(question: string, chunks: SearchResult[]): Promise<string> {
  const stream = await streamAnswer(buildPrompt(question, chunks), new AbortController().signal);
  let answer = "";
  for await (const part of stream) answer += part.text ?? "";
  return answer;
}

function printTable(summaries: Awaited<ReturnType<typeof evaluate>>[]) {
  console.table(summaries.map((summary) => ({
    chunkSize: summary.config.chunkSize,
    overlap: summary.config.overlap,
    k: summary.config.k,
    retrieval: formatRate(summary.retrievalHits, summary.grounded),
    answers: formatRate(summary.answerCorrect, summary.grounded),
    refusals: formatRate(summary.refusalsCorrect, summary.outOfScope),
  })));
}

function printFailures(results: Awaited<ReturnType<typeof evaluate>>["results"], config?: EvalConfig) {
  const failures = results.filter((result) =>
    result.retrievalHit === false || result.answerCorrect === false || result.refusalCorrect === false);
  if (!failures.length) return;
  const label = config
    ? " for chunk=" + config.chunkSize + ", overlap=" + config.overlap + ", k=" + config.k
    : "";
  console.log("\nFailures" + label + ":");
  for (const failure of failures) {
    console.log("- " + failure.question + " (retrieved pages: " + (failure.pages.join(", ") || "none") + ")");
  }
}

function formatRate(value: number, total: number): string {
  return value + "/" + total + " (" + (total ? Math.round(value / total * 100) : 0) + "%)";
}

async function readJson(name: string): Promise<unknown> {
  const path = fileURLToPath(new URL(name, import.meta.url));
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function parseQuestions(value: unknown): EvalQuestion[] {
  if (!Array.isArray(value) || value.length < 15 || value.length > 20 ||
    !value.every((item) => typeof item === "object" && item !== null &&
      "question" in item && typeof item.question === "string" &&
      "expectedAnswerContains" in item && Array.isArray(item.expectedAnswerContains) &&
      item.expectedAnswerContains.every((keyword: unknown) => typeof keyword === "string") &&
      (!("expectedPage" in item) || item.expectedPage === undefined ||
        (typeof item.expectedPage === "number" && Number.isInteger(item.expectedPage))) &&
      (!("outOfScope" in item) || item.outOfScope === undefined || typeof item.outOfScope === "boolean"))) {
    throw new Error("questions.json must contain 15-20 valid evaluation questions.");
  }
  return value as EvalQuestion[];
}

function parseSample(value: unknown): SampleDocument {
  if (typeof value !== "object" || value === null ||
    !("title" in value) || typeof value.title !== "string" ||
    !("source" in value) || typeof value.source !== "string" ||
    !("pages" in value) || !Array.isArray(value.pages) ||
    !value.pages.every((page) => typeof page === "object" && page !== null &&
      "page" in page && typeof page.page === "number" && Number.isInteger(page.page) &&
      "text" in page && typeof page.text === "string" && page.text.length > 0)) {
    throw new Error("sample-document.json is invalid.");
  }
  return value as SampleDocument;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Evaluation failed.");
  process.exitCode = 1;
});
