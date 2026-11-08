import 'server-only';
import { type Db, MongoClient } from 'mongodb';
import { getConfig } from './config';

interface DbState {
  client: MongoClient;
  db: Promise<Db>;
}

/**
 * One MongoDB client per process, in globalThis so hot reload and every route
 * share it. On Vercel each warm instance keeps its connection between requests;
 * the small pool keeps the number of connections to Atlas low.
 */
const globalDb = globalThis as typeof globalThis & { __eldenCoopDb?: DbState };

export function getDb(): Promise<Db> {
  if (!globalDb.__eldenCoopDb) {
    const { mongodbUri, mongodbDb } = getConfig();
    const client = new MongoClient(mongodbUri, { maxPoolSize: 5, appName: 'elden-coop-map' });
    const db = client.connect().then(async (connected) => {
      const db = connected.db(mongodbDb);
      // The lobby lists the most recently used teams first.
      await db.collection('teams').createIndex({ updatedAt: -1 });
      return db;
    });
    // A failed connection is retried on the next request instead of being cached.
    db.catch(() => {
      if (globalDb.__eldenCoopDb?.client === client) delete globalDb.__eldenCoopDb;
    });
    globalDb.__eldenCoopDb = { client, db };
  }
  return globalDb.__eldenCoopDb.db;
}

/** Closes the connection (tests). */
export async function closeDb() {
  const state = globalDb.__eldenCoopDb;
  delete globalDb.__eldenCoopDb;
  await state?.client.close();
}
