import { MongoClient, type Db } from "mongodb";
import { getMongoConfig } from "../config.js";

let client: MongoClient | undefined;
let database: Db | undefined;

export async function getDb(): Promise<Db> {
  if (database) return database;
  const config = getMongoConfig();
  client ??= new MongoClient(config.uri);
  await client.connect();
  database = client.db(config.database);
  return database;
}
