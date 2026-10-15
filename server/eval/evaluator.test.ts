import assert from "node:assert/strict";
import test from "node:test";
import { createLocalRetriever, evaluate, extractiveAnswer } from "./evaluator.js";

test("scores retrieval, answers, and refusals independently", async () => {
  const config = { chunkSize: 500, overlap: 100, k: 3 };
  const retrieve = createLocalRetriever([
    { page: 1, text: "Apollo launched on July 16 with three astronauts aboard." },
  ], config);
  const summary = await evaluate([
    { question: "When did Apollo launch?", expectedAnswerContains: ["July 16"], expectedPage: 1 },
    { question: "What was the crew's favorite song?", expectedAnswerContains: [], outOfScope: true },
  ], config, retrieve, extractiveAnswer);

  assert.equal(summary.retrievalHits, 1);
  assert.equal(summary.answerCorrect, 1);
  assert.equal(summary.refusalsCorrect, 1);
  assert.equal(summary.results[0].pages[0], 1);
});
