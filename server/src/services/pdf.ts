import { PDFParse } from "pdf-parse";

export type PdfPage = { page: number; text: string };

export class PdfValidationError extends Error {}

export async function extractPages(buffer: Buffer): Promise<PdfPage[]> {
  if (!buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
    throw new PdfValidationError("The file is not a valid PDF.");
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const pages = result.pages.map(({ num, text }) => ({ page: num, text: text.trim() }));
    if (!pages.some(({ text }) => text.length > 0)) {
      throw new PdfValidationError("No text found. Scanned PDFs need OCR; upload a PDF with selectable text.");
    }
    return pages;
  } catch (error) {
    if (error instanceof PdfValidationError) throw error;
    if (error instanceof Error && error.name === "PasswordException") {
      throw new PdfValidationError("This PDF is password-protected. Upload an unlocked copy.");
    }
    throw new PdfValidationError("Unable to read this PDF. It may be corrupted; try another file.");
  } finally {
    await parser.destroy();
  }
}
