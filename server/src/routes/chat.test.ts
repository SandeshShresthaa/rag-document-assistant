import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { createChatHandler } from "./chat.js";
import { busyMessage } from "../services/generateWithRetry.js";

test("JSON chat validates input, returns replies and safe error statuses", async () => {
  const app = express();
  app.use(express.json());
  app.post("/api/chat", createChatHandler(async (message) => {
    if (message === "busy") throw { status: 503 };
    if (message === "limited") throw { status: 429 };
    if (message === "failure") throw new Error("private upstream details");
    return "Hello";
  }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    for (const [message, status, body] of [
      ["hi", 200, { reply: "Hello" }],
      ["busy", 503, { error: busyMessage }],
      ["limited", 503, { error: busyMessage }],
      ["failure", 500, { error: "Unable to get an answer. Please try again." }],
      ["  ", 400, { error: "A non-empty message is required" }],
      [42, 400, { error: "A non-empty message is required" }],
    ] as const) {
      const response: Response = await fetch(`http://127.0.0.1:${address.port}/api/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }),
      });
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), body);
    }
  } finally {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
});
