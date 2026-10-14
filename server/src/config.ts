function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured in server/.env.`);
  return value;
}

export function getEmbeddingConfig() {
  const rawDimensions = process.env.EMBEDDING_DIMENSIONS?.trim() ?? "768";
  const dimensions = Number(rawDimensions);
  if (!Number.isSafeInteger(dimensions) || dimensions < 1) {
    throw new Error("EMBEDDING_DIMENSIONS must be a positive integer.");
  }
  return {
    model: required("GEMINI_EMBEDDING_MODEL"),
    dimensions,
  };
}

export function getMongoConfig() {
  return {
    uri: required("MONGODB_URI"),
    database: process.env.MONGODB_DB?.trim() || "ragdocs",
  };
}
