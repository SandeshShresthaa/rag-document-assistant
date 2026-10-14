import { Router } from "express";
import { RetrievalValidationError, searchChunks, type SearchResult } from "../services/retrieval.js";

type Search = (question: string, options: {
  sessionId: string;
  documentIds?: string[];
  k?: number;
}) => Promise<SearchResult[]>;

export function createDebugSearchRouter(search: Search = searchChunks) {
  const router = Router();
  router.get("/search", async (req, res) => {
    const question = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
    const documentIds = typeof req.query.documentIds === "string"
      ? req.query.documentIds.split(",").map((id) => id.trim()).filter(Boolean)
      : undefined;
    const kValue = typeof req.query.k === "string" ? Number(req.query.k) : undefined;
    try {
      const results = await search(question, { sessionId, documentIds, k: kValue });
      res.json({ results });
    } catch (error) {
      if (error instanceof RetrievalValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "Unable to search documents. Please try again." });
    }
  });
  return router;
}

export const debugSearchRouter = createDebugSearchRouter();
