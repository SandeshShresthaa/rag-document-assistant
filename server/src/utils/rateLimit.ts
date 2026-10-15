import type { RequestHandler } from "express";
import { AppError } from "./errors.js";

type RateLimitOptions = {
  limit?: number;
  windowMs?: number;
  now?: () => number;
};

type Entry = { count: number; resetAt: number };

export function createRateLimiter({
  limit = 30,
  windowMs = 60_000,
  now = Date.now,
}: RateLimitOptions = {}): RequestHandler {
  const requests = new Map<string, Entry>();

  return (req, _res, next) => {
    const sessionId = readSessionId(req.body) ?? readSessionId(req.query);
    const key = sessionId ? `session:${sessionId}` : `ip:${req.ip ?? "unknown"}`;
    const time = now();
    const current = requests.get(key);
    const entry = !current || current.resetAt <= time
      ? { count: 1, resetAt: time + windowMs }
      : { ...current, count: current.count + 1 };
    requests.set(key, entry);

    if (entry.count > limit) {
      next(new AppError(429, "Too many requests. Please wait a minute and try again."));
      return;
    }
    next();
  };
}

function readSessionId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("sessionId" in value)) return;
  return typeof value.sessionId === "string" ? value.sessionId : undefined;
}
