import { ObjectId, type Db, type Document } from "mongodb";
import { getDb } from "../db/mongo.js";
import { embedQuery } from "./embeddings.js";

export const VECTOR_INDEX_NAME = "chunk_vector_index";

export class RetrievalValidationError extends Error {}

export type SearchResult = {
  documentId: string;
  documentName: string;
  page: number;
  chunkIndex: number;
  text: string;
  score: number;
};

export type SearchOptions = {
  sessionId: string;
  documentIds?: string[];
  k?: number;
};

type RetrievalDependencies = {
  embed: (question: string) => Promise<number[]>;
  database: () => Promise<Db>;
};

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createSearchChunks(
  dependencies: RetrievalDependencies = { embed: embedQuery, database: getDb },
) {
  return async function searchChunks(question: string, options: SearchOptions): Promise<SearchResult[]> {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) throw new RetrievalValidationError("A non-empty search question is required.");
    if (!SESSION_ID_PATTERN.test(options.sessionId)) throw new RetrievalValidationError("A valid sessionId is required.");
    const k = options.k ?? 5;
    if (!Number.isSafeInteger(k) || k < 1 || k > 20) {
      throw new RetrievalValidationError("k must be an integer from 1 to 20.");
    }

    const filter: Document = { sessionId: options.sessionId };
    if (options.documentIds) {
      if (!options.documentIds.length || options.documentIds.some((id) => !ObjectId.isValid(id))) {
        throw new RetrievalValidationError("documentIds must contain valid MongoDB IDs.");
      }
      filter.documentId = { $in: options.documentIds.map((id) => new ObjectId(id)) };
    }

    const queryVector = await dependencies.embed(trimmedQuestion);
    const db = await dependencies.database();
    const rows = await db.collection("chunks").aggregate<{
      documentId: ObjectId;
      documentName: string;
      page: number;
      chunkIndex: number;
      text: string;
      score: number;
    }>([
      { $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: "embedding",
        queryVector,
        numCandidates: Math.max(100, k * 20),
        limit: k,
        filter,
      } },
      { $project: {
        _id: 0,
        documentId: 1,
        documentName: 1,
        page: 1,
        chunkIndex: 1,
        text: 1,
        score: { $meta: "vectorSearchScore" },
      } },
    ]).toArray();

    return rows.map((row) => ({ ...row, documentId: row.documentId.toHexString() }));
  };
}

export const searchChunks = createSearchChunks();
