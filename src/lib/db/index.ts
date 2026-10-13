import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { DDL_SCHEMA } from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __sastmhaly_db: Database.Database | undefined;
}

function getDatabase(): Database.Database {
  if (global.__sastmhaly_db) {
    return global.__sastmhaly_db;
  }

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'sastmhaly.db');
  const db = new Database(dbPath);

  // Enable WAL mode for high concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  // Execute DDL schema
  db.exec(DDL_SCHEMA);

  global.__sastmhaly_db = db;
  return db;
}

export const db = getDatabase();

export default db;
