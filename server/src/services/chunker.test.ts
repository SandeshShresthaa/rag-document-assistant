import assert from "node:assert/strict";
import test from "node:test";
import { chunkPages } from "./chunker.js";

test("short page produces one chunk with cleaned whitespace", () => {
  const pages = [{ page: 4, text: "  This  is\ta short\r\npage with enough text to become one chunk.  " }];
  assert.deepEqual(chunkPages(pages), [{
    page: 4, chunkIndex: 0, text: "This is a short page with enough text to become one chunk.",
  }]);
  assert.ok(pages[0].text.startsWith("  "), "input is not mutated");
});

test("long text uses 800-character windows and 150-character overlap without gaps", () => {
  const text = Array.from({ length: 450 }, (_, i) => String(i).padStart(4, "0")).join("");
  const chunks = chunkPages([{ page: 1, text }]);
  assert.deepEqual(chunks.map((chunk) => chunk.text.length), [800, 800, 500]);
  assert.equal(chunks[0].text + chunks.slice(1).map((chunk) => chunk.text.slice(150)).join(""), text);
  for (let i = 1; i < chunks.length; i++) {
    assert.equal(chunks[i - 1].text.slice(-150), chunks[i].text.slice(0, 150));
  }
});

test("empty pages and text shorter than 30 characters produce no chunks", () => {
  assert.deepEqual(chunkPages([]), []);
  assert.deepEqual(chunkPages([{ page: 1, text: " \r\n\t" }, { page: 2, text: "x".repeat(29) }]), []);
  assert.equal(chunkPages([{ page: 3, text: "x".repeat(30) }]).length, 1);
});

test("prefers sentence and paragraph boundaries near the end of the window", () => {
  for (const separator of [". ", "! ", "? ", ".\" ", "\r\n \r\n"]) {
    const chunks = chunkPages([{ page: 1, text: "a".repeat(65) + separator + "b".repeat(100) }], { size: 100, overlap: 20 });
    assert.ok(!chunks[0].text.includes("b"));
    assert.ok(chunks.every((chunk) => chunk.text.length >= 30 && chunk.text.length <= 100));
    assert.ok(chunks.at(-1)?.text.endsWith("b".repeat(30)));
  }
});

test("keeps pages separate and assigns consecutive document-wide indexes", () => {
  const chunks = chunkPages([
    { page: 2, text: "a".repeat(120) },
    { page: 3, text: " " },
    { page: 4, text: "b".repeat(50) },
  ], { size: 100, overlap: 20 });
  assert.deepEqual(chunks, [
    { page: 2, chunkIndex: 0, text: "a".repeat(100) },
    { page: 2, chunkIndex: 1, text: "a".repeat(40) },
    { page: 4, chunkIndex: 2, text: "b".repeat(50) },
  ]);
});

test("handles zero overlap, tiny tails, exact-size pages and overlap near size", () => {
  assert.deepEqual(chunkPages([{ page: 1, text: "a".repeat(110) }], { size: 100, overlap: 0 }), [
    { page: 1, chunkIndex: 0, text: "a".repeat(100) },
  ]);
  assert.equal(chunkPages([{ page: 1, text: "a".repeat(800) }]).length, 1);
  const chunks = chunkPages([{ page: 1, text: "a".repeat(40) + ". " + "b".repeat(80) }], { size: 100, overlap: 99 });
  assert.equal(chunks.length, 23);
  assert.ok(chunks.every((chunk) => chunk.text.length === 100));
});

test("invalid options fail immediately instead of risking a non-advancing loop", () => {
  for (const size of [0, -1, 29, 30.5, NaN, Infinity]) {
    assert.throws(() => chunkPages([], { size, overlap: 0 }), RangeError);
  }
  for (const overlap of [-1, 0.5, 800, 801, NaN, Infinity]) {
    assert.throws(() => chunkPages([], { overlap }), RangeError);
  }
});
