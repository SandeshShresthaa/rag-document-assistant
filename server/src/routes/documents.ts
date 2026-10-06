import { Router } from "express";
import multer from "multer";
import { extractPages, PdfValidationError } from "../services/pdf.js";
import { chunkPages } from "../services/chunker.js";

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

export const documentsRouter = Router();

documentsRouter.post("/", (req, res, next) => {
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
  try {
    const pages = await extractPages(req.file.buffer);
    const chunks = chunkPages(pages);
    // Temporary learning previews; no file, text, or chunks are persisted.
    console.log("PDF extraction:", { pages: pages.length, preview: pages[0]?.text.slice(0, 200) ?? "" });
    console.log("PDF chunks:", { count: chunks.length, samples: chunks.slice(0, 2) });
    res.json({ name: req.file.originalname, pages: pages.length });
  } catch (error) {
    res.status(error instanceof PdfValidationError ? 400 : 500).json({
      error: error instanceof PdfValidationError ? error.message : "Unable to process the PDF. Please try again.",
    });
  }
});
