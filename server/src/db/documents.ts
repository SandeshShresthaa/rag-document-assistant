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

export type DocumentSummary = {
  documentId: string;
  name: string;
  pages: number;
  chunks: number;
  createdAt: string;
};

type DocumentRecord = {
  _id: ObjectId;
  name: string;
  pages: number;
  chunkCount: number;
  createdAt: Date;
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

export async function listDocuments(sessionId: string): Promise<DocumentSummary[]> {
  return listDocumentsWithDb(await getDb(), sessionId);
}

export async function listDocumentsWithDb(db: Db, sessionId: string): Promise<DocumentSummary[]> {
  const records = await db.collection<DocumentRecord>("documents")
    .find({ sessionId }, { projection: { name: 1, pages: 1, chunkCount: 1, createdAt: 1 } })
    .sort({ createdAt: -1 })
    .toArray();
  return records.map((record) => ({
    documentId: record._id.toHexString(),
    name: record.name,
    pages: record.pages,
    chunks: record.chunkCount,
    createdAt: record.createdAt.toISOString(),
  }));
}

export async function getSessionUsage(sessionId: string): Promise<{ documents: number; chunks: number }> {
  const documents = await listDocuments(sessionId);
  return {
    documents: documents.length,
    chunks: documents.reduce((total, document) => total + document.chunks, 0),
  };
}

export async function deleteDocument(documentId: string, sessionId: string): Promise<boolean> {
  return deleteDocumentWithDb(await getDb(), documentId, sessionId);
}

export async function deleteDocumentWithDb(db: Db, documentId: string, sessionId: string): Promise<boolean> {
  const _id = new ObjectId(documentId);
  const ownedDocument = await db.collection("documents").findOne({ _id, sessionId }, { projection: { _id: 1 } });
  if (!ownedDocument) return false;
  await db.collection("chunks").deleteMany({ documentId: _id, sessionId });
  const result = await db.collection("documents").deleteOne({ _id, sessionId });
  return result.deletedCount === 1;
}
