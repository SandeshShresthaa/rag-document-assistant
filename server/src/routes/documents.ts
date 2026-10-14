import { Router } from "express";
import multer from "multer";
import { extractPages, PdfValidationError } from "../services/pdf.js";
import { chunkPages } from "../services/chunker.js";
import { embedTexts } from "../services/embeddings.js";
import { storeDocument, type StoredDocument } from "../db/documents.js";

export const MAX_PDF_BYTES = 5 * 1024 * 1024;

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
};

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createDocumentsRouter(
  dependencies: DocumentDependencies = { embed: embedTexts, store: storeDocument },
) {
  const router = Router();

  router.post("/", (req, res, next) => {
    upload(req, res, (error: unknown) => {
      if (error) {
        const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
          ? "PDF must be 5 MB or smaller."
          : error instanceof PdfValidationError ? error.message : "Upload one PDF using the file field.";
        res.status(400).json({ error: message });
        return;
      }
      next();
    });
  }, async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "Choose a PDF to upload." });
      return;
    }
    const sessionId = typeof req.body.sessionId === "string" ? req.body.sessionId.trim() : "";
    if (!SESSION_ID_PATTERN.test(sessionId)) {
      res.status(400).json({ error: "A valid sessionId is required." });
      return;
    }
    try {
      const pages = await extractPages(req.file.buffer);
      const chunks = chunkPages(pages);
      if (!chunks.length) {
        res.status(400).json({ error: "The PDF does not contain enough text to create a searchable chunk." });
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
      res.status(error instanceof PdfValidationError ? 400 : 500).json({
        error: error instanceof PdfValidationError ? error.message : "Unable to save the PDF. Please try again.",
      });
    }
  });
  return router;
}

export const documentsRouter = createDocumentsRouter();
