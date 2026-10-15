import { Router } from "express";
import multer from "multer";
import { ObjectId } from "mongodb";
import { extractPages, PdfValidationError } from "../services/pdf.js";
import { chunkPages } from "../services/chunker.js";
import { embedTexts } from "../services/embeddings.js";
import {
  deleteDocument, getSessionUsage, listDocuments, storeDocument,
  type DocumentSummary, type StoredDocument,
} from "../db/documents.js";
import { busyMessage, isBusyError } from "../services/generateWithRetry.js";
import { AppError } from "../utils/errors.js";

export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENTS_PER_SESSION = 5;
export const MAX_CHUNKS_PER_SESSION = 500;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES, files: 1, fields: 1, parts: 2 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== "application/pdf") {
      callback(new PdfValidationError("Only PDF files are allowed."));
      return;
    }
    callback(null, true);
  },
}).single("file");

type DocumentDependencies = {
  embed: (texts: string[]) => Promise<number[][]>;
  store: (document: StoredDocument) => Promise<string>;
  list: (sessionId: string) => Promise<DocumentSummary[]>;
  remove: (documentId: string, sessionId: string) => Promise<boolean>;
  usage: (sessionId: string) => Promise<{ documents: number; chunks: number }>;
};

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createDocumentsRouter(
  provided: Partial<DocumentDependencies> = {},
) {
  const dependencies: DocumentDependencies = {
    embed: embedTexts, store: storeDocument, list: listDocuments,
    remove: deleteDocument, usage: getSessionUsage, ...provided,
  };
  const router = Router();

  router.get("/", async (req, res, next) => {
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
    if (!SESSION_ID_PATTERN.test(sessionId)) {
      next(new AppError(400, "A valid sessionId is required."));
      return;
    }
    try {
      res.json({ documents: await dependencies.list(sessionId) });
    } catch {
      next(new AppError(503, "Unable to load documents. Please try again."));
    }
  });

  router.delete("/:id", async (req, res, next) => {
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
    if (!SESSION_ID_PATTERN.test(sessionId) || !ObjectId.isValid(req.params.id)) {
      next(new AppError(400, "A valid document id and sessionId are required."));
      return;
    }
    try {
      const deleted = await dependencies.remove(req.params.id, sessionId);
      if (!deleted) {
        next(new AppError(404, "Document not found."));
        return;
      }
      res.status(204).end();
    } catch {
      next(new AppError(503, "Unable to delete the document. Please try again."));
    }
  });

  router.post("/", (req, res, next) => {
    upload(req, res, (error: unknown) => {
      if (error) {
        const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
          ? "PDF must be 5 MB or smaller."
          : error instanceof PdfValidationError ? error.message : "Upload one PDF using the file field.";
        next(new AppError(400, message));
        return;
      }
      next();
    });
  }, async (req, res, next) => {
    if (!req.file) {
      next(new AppError(400, "Choose a PDF to upload."));
      return;
    }
    const sessionId = typeof req.body.sessionId === "string" ? req.body.sessionId.trim() : "";
    if (!SESSION_ID_PATTERN.test(sessionId)) {
      next(new AppError(400, "A valid sessionId is required."));
      return;
    }
    try {
      const usage = await dependencies.usage(sessionId);
      if (usage.documents >= MAX_DOCUMENTS_PER_SESSION) {
        next(new AppError(409, `This session can store up to ${MAX_DOCUMENTS_PER_SESSION} documents.`));
        return;
      }
      const pages = await extractPages(req.file.buffer);
      const chunks = chunkPages(pages);
      if (!chunks.length) {
        next(new AppError(400, "The PDF does not contain enough text to create a searchable chunk."));
        return;
      }
      if (usage.chunks + chunks.length > MAX_CHUNKS_PER_SESSION) {
        next(new AppError(409, `This session can store up to ${MAX_CHUNKS_PER_SESSION} document chunks.`));
        return;
      }
      const embeddings = await dependencies.embed(chunks.map((chunk) => chunk.text));
      const documentId = await dependencies.store({
        sessionId,
        name: req.file.originalname,
        pages: pages.length,
        chunks,
        embeddings,
      });
      res.status(201).json({ documentId, name: req.file.originalname, pages: pages.length, chunks: chunks.length });
    } catch (error) {
      next(error instanceof PdfValidationError
        ? new AppError(400, error.message)
        : new AppError(isBusyError(error) ? 503 : 500,
          isBusyError(error) ? busyMessage : "Unable to save the PDF. Please try again."));
    }
  });
  return router;
}

export const documentsRouter = createDocumentsRouter();
