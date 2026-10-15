import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { errorHandler } from "./errors.js";
import { createRateLimiter } from "./rateLimit.js";

test("limits each session independently and resets after the window", async () => {
  let time = 1_000;
  const app = express();
  app.use(express.json());
  app.use(createRateLimiter({ limit: 2, windowMs: 100, now: () => time }));
  app.post("/", (_req, res) => { res.json({ ok: true }); });
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const post = (sessionId: string) => fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  try {
    assert.equal((await post("session-a")).status, 200);
    assert.equal((await post("session-a")).status, 200);
    const limited = await post("session-a");
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), {
      error: "Too many requests. Please wait a minute and try again.",
    });
    assert.equal((await post("session-b")).status, 200);
    time += 100;
    assert.equal((await post("session-a")).status, 200);
  } finally {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
});
