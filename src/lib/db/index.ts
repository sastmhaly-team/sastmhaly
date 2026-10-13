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

  let dbPath: string;
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (isServerless) {
    // Vercel serverless execution environment: only /tmp is writable
    dbPath = path.join('/tmp', 'sastmhaly.db');
    const sourceDbPath = path.join(process.cwd(), 'data', 'sastmhaly.db');

    if (!fs.existsSync(/*turbopackIgnore: true*/ dbPath)) {
      if (fs.existsSync(sourceDbPath)) {
        try {
          fs.copyFileSync(sourceDbPath, dbPath);
        } catch (e) {
          console.error('Failed to copy bundled db to /tmp, will initialize fresh:', e);
        }
      }
    }
  } else {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    dbPath = path.join(dataDir, 'sastmhaly.db');
  }

  const db = new Database(dbPath);

  try {
    // Enable WAL mode for high concurrency
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = NORMAL');

    // Execute DDL schema
    db.exec(DDL_SCHEMA);
  } catch (err) {
    console.error('Database initialization warning:', err);
  }

  global.__sastmhaly_db = db;
  return db;
}

export const db = getDatabase();

export default db;
