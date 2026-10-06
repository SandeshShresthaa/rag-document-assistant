import assert from "node:assert/strict";
import test from "node:test";
import { extractPages } from "./pdf.js";
import { makePdf } from "../../test/pdfFixture.js";

test("extracts text per page and preserves pages without text in mixed PDFs", async () => {
  assert.deepEqual(await extractPages(makePdf(["First page text", null, "Third page text"])), [
    { page: 1, text: "First page text" }, { page: 2, text: "" }, { page: 3, text: "Third page text" },
  ]);
});

test("rejects image-only, invalid and corrupt PDFs with clear messages", async () => {
  await assert.rejects(extractPages(makePdf([null])), /No text found/);
  await assert.rejects(extractPages(Buffer.from("not a PDF")), /not a valid PDF/);
  await assert.rejects(extractPages(Buffer.from("%PDF-1.4\nbroken")), /corrupted/);
});
