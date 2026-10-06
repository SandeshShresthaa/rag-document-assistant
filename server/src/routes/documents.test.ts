import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { documentsRouter, MAX_PDF_BYTES } from "./documents.js";
import { makePdf } from "../../test/pdfFixture.js";

test("real multipart uploads extract PDFs and return JSON validation errors", async (t) => {
  const app = express();
  app.use("/api/documents", documentsRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const logs: unknown[][] = [];
  t.mock.method(console, "log", (...args: unknown[]) => logs.push(args));
  try {
    const cases = [
      { data: makePdf(["Hello page one", "Hello page two"]), type: "application/pdf", status: 200 },
      { data: Buffer.from("hello"), type: "text/plain", status: 400, error: /Only PDF/ },
      { data: Buffer.from("fake"), type: "application/pdf", status: 400, error: /not a valid PDF/ },
      { data: Buffer.alloc(MAX_PDF_BYTES + 1), type: "application/pdf", status: 400, error: /5 MB/ },
      { data: makePdf([null]), type: "application/pdf", status: 400, error: /No text found/ },
      { data: Buffer.from("%PDF-1.4\nbroken"), type: "application/pdf", status: 400, error: /corrupted/ },
      { data: makePdf(["test"]), type: "application/pdf", field: "wrong", status: 400, error: /file field/ },
      { status: 400, error: /Choose a PDF/ },
    ];
    for (const item of cases) {
      const body = new FormData();
      if (item.data) body.append(item.field ?? "file", new Blob([new Uint8Array(item.data)], { type: item.type }), "sample.pdf");
      const response: Response = await fetch(`http://127.0.0.1:${address.port}/api/documents`, { method: "POST", body });
      assert.equal(response.status, item.status);
      const result = await response.json();
      if (item.error) assert.match(result.error, item.error);
      else assert.deepEqual(result, { name: "sample.pdf", pages: 2 });
    }
    assert.deepEqual(logs, [["PDF extraction:", { pages: 2, preview: "Hello page one" }]]);
  } finally {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
});
