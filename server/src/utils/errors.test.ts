import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { AppError, errorHandler } from "./errors.js";

test("returns safe JSON for expected, malformed, and unexpected errors", async () => {
  const app = express();
  app.use(express.json());
  app.post("/expected", () => { throw new AppError(409, "Expected failure."); });
  app.post("/unexpected", () => { throw new Error("private details"); });
  app.post("/json", (_req, res) => { res.json({ ok: true }); });
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const expected = await fetch(`${base}/expected`, { method: "POST" });
    assert.equal(expected.status, 409);
    assert.deepEqual(await expected.json(), { error: "Expected failure." });

    const malformed = await fetch(`${base}/json`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad",
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: "The request contains invalid JSON." });

    const unexpected = await fetch(`${base}/unexpected`, { method: "POST" });
    assert.equal(unexpected.status, 500);
    assert.deepEqual(await unexpected.json(), { error: "Something went wrong. Please try again." });
  } finally {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
});
