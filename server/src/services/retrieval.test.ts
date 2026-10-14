import assert from "node:assert/strict";
import test from "node:test";
import { ObjectId, type Db } from "mongodb";
import { createSearchChunks, VECTOR_INDEX_NAME } from "./retrieval.js";

const sessionId = "123e4567-e89b-42d3-a456-426614174000";

test("embeds a trimmed question and runs a session-filtered vector query", async () => {
  const documentId = new ObjectId();
  let embedded = "";
  let pipeline: unknown[] = [];
  const database = {
    collection(name: string) {
      assert.equal(name, "chunks");
      return { aggregate(received: unknown[]) {
        pipeline = received;
        return { toArray: async () => [{
          documentId, documentName: "guide.pdf", page: 2, chunkIndex: 3,
          text: "Relevant text", score: 0.91,
        }] };
      } };
    },
  } as unknown as Db;
  const search = createSearchChunks({
    embed: async (question) => { embedded = question; return [0.1, 0.2]; },
    database: async () => database,
  });

  assert.deepEqual(await search("  What is stored? ", { sessionId, k: 3 }), [{
    documentId: documentId.toHexString(), documentName: "guide.pdf", page: 2,
    chunkIndex: 3, text: "Relevant text", score: 0.91,
  }]);
  assert.equal(embedded, "What is stored?");
  assert.deepEqual(pipeline, [
    { $vectorSearch: {
      index: VECTOR_INDEX_NAME, path: "embedding", queryVector: [0.1, 0.2],
      numCandidates: 100, limit: 3, filter: { sessionId },
    } },
    { $project: {
      _id: 0, documentId: 1, documentName: 1, page: 1, chunkIndex: 1, text: 1,
      score: { $meta: "vectorSearchScore" },
    } },
  ]);
});

test("adds ObjectId document filters and validates inputs before external calls", async () => {
  const ids = [new ObjectId(), new ObjectId()];
  let pipeline: unknown[] = [];
  const database = { collection: () => ({ aggregate(received: unknown[]) {
    pipeline = received;
    return { toArray: async () => [] };
  } }) } as unknown as Db;
  let embedCalls = 0;
  const search = createSearchChunks({
    embed: async () => { embedCalls++; return [1]; }, database: async () => database,
  });
  await search("question", { sessionId, documentIds: ids.map(String) });
  const stage = pipeline[0] as { $vectorSearch: { filter: { documentId: { $in: ObjectId[] } } } };
  assert.deepEqual(stage.$vectorSearch.filter.documentId.$in, ids);

  for (const operation of [
    search(" ", { sessionId }),
    search("question", { sessionId: "bad" }),
    search("question", { sessionId, k: 0 }),
    search("question", { sessionId, k: 21 }),
    search("question", { sessionId, documentIds: [] }),
    search("question", { sessionId, documentIds: ["bad"] }),
  ]) await assert.rejects(operation);
  assert.equal(embedCalls, 1);
});
