import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { PendingSet } from "./types";

const DB_NAME = "alfheim-workout";
const DB_VERSION = 1;
export const PENDING_SETS_STORE = "pendingSets";
export const SESSION_INDEX = "bySessionId";

interface WorkoutDB extends DBSchema {
  [PENDING_SETS_STORE]: {
    key: string;
    value: PendingSet;
    indexes: { [SESSION_INDEX]: string };
  };
}

let dbPromise: Promise<IDBPDatabase<WorkoutDB>> | null = null;

/**
 * Open (and memoize) the IndexedDB handle.
 *
 * IndexedDB is used rather than localStorage because a queue written during a
 * long offline gym session can outgrow localStorage's ~5MB string budget, and
 * because writes here are asynchronous and do not block the logging UI.
 */
export function getDb(): Promise<IDBPDatabase<WorkoutDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WorkoutDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PENDING_SETS_STORE)) {
          const store = db.createObjectStore(PENDING_SETS_STORE, {
            keyPath: "clientIdempotencyKey",
          });
          store.createIndex(SESSION_INDEX, "sessionId");
        }
      },
    });
  }
  return dbPromise;
}

/** Reset and close the memoized handle. Test-only; production code never needs this. */
export async function closeDbForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

/** Reset the memoized handle. Test-only; production code never needs this. */
export function resetDbForTests(): void {
  dbPromise = null;
}

/** True when this environment can persist a queue at all. */
export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}
