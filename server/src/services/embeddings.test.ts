import assert from "node:assert/strict";
import test from "node:test";
import { createEmbedTexts } from "./embeddings.js";

test("embeds in ordered batches with retrieval configuration and a small delay", async () => {
  const calls: unknown[] = [];
  const waits: number[] = [];
  const embed = createEmbedTexts(async (params) => {
    calls.push(params);
    return { embeddings: params.contents.map((content) => ({ values: [content.parts[0].text.length, 1, 2] })) };
  }, { model: "test-embedding", dimensions: 3, batchSize: 2, waitBetweenBatches: async (ms) => { waits.push(ms); } });

  assert.deepEqual(await embed(["one", "three", "seven"]), [[3, 1, 2], [5, 1, 2], [5, 1, 2]]);
  assert.deepEqual(calls, [
    { model: "test-embedding", contents: [
      { role: "user", parts: [{ text: "one" }] },
      { role: "user", parts: [{ text: "three" }] },
    ], config: { outputDimensionality: 3, taskType: "RETRIEVAL_DOCUMENT" } },
    { model: "test-embedding", contents: [
      { role: "user", parts: [{ text: "seven" }] },
    ], config: { outputDimensionality: 3, taskType: "RETRIEVAL_DOCUMENT" } },
  ]);
  assert.deepEqual(waits, [100]);
});

test("retries busy embedding batches and rejects malformed vectors", async () => {
  let calls = 0;
  const embed = createEmbedTexts(async () => {
    calls++;
    if (calls < 3) throw { status: 429 };
    return { embeddings: [{ values: [1, 2] }] };
  }, { model: "test", dimensions: 2 });
  assert.deepEqual(await embed(["text"]), [[1, 2]]);
  assert.equal(calls, 3);

  for (const embeddings of [[], [{ values: [1] }], [{ values: [1, Number.NaN] }]]) {
    const invalid = createEmbedTexts(async () => ({ embeddings }), { model: "test", dimensions: 2 });
    await assert.rejects(invalid(["text"]), /embedding|vectors/i);
  }
});

test("handles empty input and validates text and batch size", async () => {
  const embed = createEmbedTexts(async () => { assert.fail("must not call API"); }, { model: "test", dimensions: 2 });
  assert.deepEqual(await embed([]), []);
  await assert.rejects(embed([" "]), /non-empty/);
  assert.throws(() => createEmbedTexts(async () => ({}), { model: "test", dimensions: 2, batchSize: 0 }), RangeError);
});

test("supports retrieval-query embeddings separately from document embeddings", async () => {
  const taskTypes: string[] = [];
  const embed = createEmbedTexts(async (params) => {
    taskTypes.push(params.config.taskType);
    return { embeddings: [{ values: [1, 2] }] };
  }, { model: "test", dimensions: 2, taskType: "RETRIEVAL_QUERY" });
  assert.deepEqual(await embed(["question"]), [[1, 2]]);
  assert.deepEqual(taskTypes, ["RETRIEVAL_QUERY"]);
});
