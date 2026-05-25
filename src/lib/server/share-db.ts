import Database from 'better-sqlite3';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import type { LayoutSchema } from '@/types/schema';

const DB_DIR = path.join(process.cwd(), '.data');
const DB_PATH = path.join(DB_DIR, 'shares.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  mkdirSync(DB_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      schema TEXT NOT NULL,
      sample_data TEXT NOT NULL,
      name TEXT,
      created_at INTEGER NOT NULL
    )
  `);
  return _db;
}

export interface ShareRecord {
  id: string;
  schema: LayoutSchema;
  sampleData: Record<string, unknown>;
  name: string | null;
  createdAt: number;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 9);
}

export function createShare(
  schema: LayoutSchema,
  sampleData: Record<string, unknown>
): ShareRecord {
  const db = getDb();
  const id = randomId();
  const now = Date.now();
  db.prepare(
    'INSERT INTO shares (id, schema, sample_data, name, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, JSON.stringify(schema), JSON.stringify(sampleData), schema.name ?? null, now);
  return { id, schema, sampleData, name: schema.name ?? null, createdAt: now };
}

export function getShare(id: string): ShareRecord | null {
  const db = getDb();
  const row = db
    .prepare('SELECT id, schema, sample_data, name, created_at FROM shares WHERE id = ?')
    .get(id) as
    | { id: string; schema: string; sample_data: string; name: string | null; created_at: number }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    schema: JSON.parse(row.schema) as LayoutSchema,
    sampleData: JSON.parse(row.sample_data) as Record<string, unknown>,
    name: row.name,
    createdAt: row.created_at,
  };
}

export function deleteShare(id: string): void {
  getDb().prepare('DELETE FROM shares WHERE id = ?').run(id);
}
