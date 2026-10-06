import type { PdfPage } from "./pdf.js";

export type Chunk = { page: number; chunkIndex: number; text: string };
type ChunkOptions = { size?: number; overlap?: number };

const MIN_CHUNK_LENGTH = 30;

export function chunkPages(
  pages: PdfPage[],
  { size = 800, overlap = 150 }: ChunkOptions = {},
): Chunk[] {
  if (!Number.isSafeInteger(size) || size < MIN_CHUNK_LENGTH) {
    throw new RangeError("Chunk size must be an integer of at least 30 characters.");
  }
  if (!Number.isSafeInteger(overlap) || overlap < 0 || overlap >= size) {
    throw new RangeError("Overlap must be a non-negative integer smaller than chunk size.");
  }

  const chunks: Chunk[] = [];
  for (const page of pages) {
    // Collapse whitespace inside paragraphs but retain blank-line boundaries.
    const text = page.text.replace(/\r\n?/g, "\n").split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
      .filter(Boolean).join("\n\n");

    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + size, text.length);
      if (end < text.length) {
        // Search near the end; a cut must also advance beyond the overlap.
        const minimumLength = Math.max(MIN_CHUNK_LENGTH, Math.ceil(size / 2), overlap + 1);
        const window = text.slice(start, end);
        let boundary = 0;
        for (const match of window.matchAll(/\n\n|[.!?]["')\]]*(?=\s)/g)) {
          const candidate = match.index + match[0].length;
          if (candidate >= minimumLength) boundary = candidate;
        }
        if (boundary > 0) end = start + boundary;
      }

      const chunkText = text.slice(start, end).trim();
      if (chunkText.length >= MIN_CHUNK_LENGTH) {
        // Index across the whole document, while page numbers stay unchanged.
        chunks.push({ page: page.page, chunkIndex: chunks.length, text: chunkText });
      }
      if (end === text.length) break;
      start = end - overlap;
    }
  }
  return chunks;
}
