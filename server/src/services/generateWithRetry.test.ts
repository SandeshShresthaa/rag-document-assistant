import assert from "node:assert/strict";
import test from "node:test";
import { generateWithRetry } from "./generateWithRetry.js";

for (const status of [429, 503]) {
  test(`retries ${status} three times per model, then uses fallback`, async () => {
    const calls: string[] = [];
    const waits: number[] = [];
    const result = await generateWithRetry(async (model) => {
      calls.push(model);
      if (model === "primary") throw { status };
      return "answer";
    }, { models: ["primary", "fallback"], wait: async (ms) => { waits.push(ms); } });
    assert.equal(result, "answer");
    assert.deepEqual(calls, ["primary", "primary", "primary", "fallback"]);
    assert.deepEqual(waits, [1000, 2000]);
  });
}

test("missing model immediately uses fallback; other permanent errors fail immediately", async () => {
  for (const status of [404, 400, 401, 403, 500]) {
    const calls: string[] = [];
    const operation = generateWithRetry(async (model) => {
      calls.push(model);
      if (model === "missing") throw { status };
      return "fallback answer";
    }, { models: ["missing", "fallback"], wait: async () => { assert.fail("must not wait"); } });
    if (status === 404) {
      assert.equal(await operation, "fallback answer");
      assert.deepEqual(calls, ["missing", "fallback"]);
    } else {
      await assert.rejects(operation, { status });
      assert.deepEqual(calls, ["missing"]);
    }
  }
});

test("exhausted models propagate busy error and do not loop indefinitely", async () => {
  let calls = 0;
  await assert.rejects(generateWithRetry(async () => {
    calls++;
    throw { status: 503 };
  }, { models: ["primary", "fallback"], wait: async () => {} }), { status: 503 });
  assert.equal(calls, 6);
});

test("abort interrupts backoff without trying again", async () => {
  const controller = new AbortController();
  let calls = 0;
  const operation = generateWithRetry(async () => {
    calls++;
    throw { status: 429 };
  }, { models: ["primary", "fallback"], signal: controller.signal });
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(operation, { name: "AbortError" });
  assert.equal(calls, 1);
});

test("deduplicates fallback and rejects empty model configuration", async () => {
  let calls = 0;
  await assert.rejects(generateWithRetry(async () => {
    calls++;
    throw { status: 503 };
  }, { models: ["primary", "primary", ""], wait: async () => {} }), { status: 503 });
  assert.equal(calls, 3);
  await assert.rejects(generateWithRetry(async () => "unused", { models: [] }), /GEMINI_MODEL/);
});
