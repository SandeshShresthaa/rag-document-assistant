import type { ErrorRequestHandler } from "express";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (hasStatus(error, 400)) {
    res.status(400).json({ error: "The request contains invalid JSON." });
    return;
  }
  if (hasStatus(error, 413)) {
    res.status(413).json({ error: "The request is too large." });
    return;
  }
  res.status(500).json({ error: "Something went wrong. Please try again." });
};

function hasStatus(error: unknown, status: number): boolean {
  return typeof error === "object" && error !== null &&
    "status" in error && error.status === status;
}
