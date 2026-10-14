import assert from "node:assert/strict";
import test from "node:test";
import type { Db } from "mongodb";
import { storeDocumentWithDb, type StoredDocument } from "./documents.js";

const input: StoredDocument = {
  sessionId: "123e4567-e89b-42d3-a456-426614174000",
  name: "guide.pdf",
  pages: 1,
  chunks: [{ page: 1, chunkIndex: 0, text: "A searchable chunk with enough text." }],
  embeddings: [[0.1, 0.2]],
};

test("stores matching document and chunk records with shared metadata", async () => {
  const writes: Record<string, unknown>[] = [];
  const database = {
    collection(name: string) {
      return {
        insertOne: async (document: Record<string, unknown>) => { writes.push({ collection: name, document }); },
        insertMany: async (documents: Record<string, unknown>[]) => { writes.push({ collection: name, documents }); },
        deleteMany: async () => {},
        deleteOne: async () => {},
      };
    },
  } as unknown as Db;

  const id = await storeDocumentWithDb(database, input);
  assert.match(id, /^[0-9a-f]{24}$/);
  const documentWrite = writes[0].document as Record<string, unknown>;
  const chunkWrite = (writes[1].documents as Record<string, unknown>[])[0];
  assert.equal(writes[0].collection, "documents");
  assert.equal(writes[1].collection, "chunks");
  assert.equal(documentWrite.sessionId, input.sessionId);
  assert.equal(documentWrite.chunkCount, 1);
  assert.equal(chunkWrite.documentId, documentWrite._id);
  assert.equal(chunkWrite.documentName, input.name);
  assert.deepEqual(chunkWrite.embedding, input.embeddings[0]);
  assert.equal(chunkWrite.createdAt, documentWrite.createdAt);
});

test("rejects mismatched vectors and cleans up both collections after a write failure", async () => {
  await assert.rejects(storeDocumentWithDb({} as Db, { ...input, embeddings: [] }), /exactly one embedding/);
  const cleanup: string[] = [];
  const database = {
    collection(name: string) {
      return {
        insertOne: async () => {},
        insertMany: async () => { throw new Error("write failed"); },
        deleteMany: async () => { cleanup.push(`many:${name}`); },
        deleteOne: async () => { cleanup.push(`one:${name}`); },
      };
    },
  } as unknown as Db;
  await assert.rejects(storeDocumentWithDb(database, input), /write failed/);
  assert.deepEqual(cleanup.sort(), ["many:chunks", "one:documents"]);
});
