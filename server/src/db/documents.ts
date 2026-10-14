import { ObjectId, type Db } from "mongodb";
import type { Chunk } from "../services/chunker.js";
import { getDb } from "./mongo.js";

export type StoredDocument = {
  sessionId: string;
  name: string;
  pages: number;
  chunks: Chunk[];
  embeddings: number[][];
};

export async function storeDocument(input: StoredDocument): Promise<string> {
  return storeDocumentWithDb(await getDb(), input);
}

export async function storeDocumentWithDb(db: Db, input: StoredDocument): Promise<string> {
  if (input.chunks.length !== input.embeddings.length) {
    throw new Error("Every chunk must have exactly one embedding.");
  }

  const documentId = new ObjectId();
  const createdAt = new Date();
  try {
    await db.collection("documents").insertOne({
      _id: documentId,
      sessionId: input.sessionId,
      name: input.name,
      pages: input.pages,
      chunkCount: input.chunks.length,
      createdAt,
    });
    await db.collection("chunks").insertMany(input.chunks.map((chunk, index) => ({
      _id: new ObjectId(),
      documentId,
      sessionId: input.sessionId,
      documentName: input.name,
      page: chunk.page,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      embedding: input.embeddings[index],
      createdAt,
    })));
    return documentId.toHexString();
  } catch (error) {
    await Promise.allSettled([
      db.collection("chunks").deleteMany({ documentId }),
      db.collection("documents").deleteOne({ _id: documentId }),
    ]);
    throw error;
  }
}
