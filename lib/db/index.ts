import path from 'path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from '@/lib/db/schema';

function getSqliteFilePath(databaseUrl: string) {
  if (!databaseUrl.startsWith('file:')) {
    throw new Error(
      `Unsupported DATABASE_URL (expected file:...): ${databaseUrl}`,
    );
  }
  return databaseUrl.replace(/^file:/, '');
}

const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
const sqlitePath = getSqliteFilePath(databaseUrl);

export const sqlite = new Database(sqlitePath);

sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

let ensured = false;
/**
 * 确保数据库已迁移（开发/自托管场景防止空库导致 API 直接 500）。
 * - 仅在发现关键表缺失时执行迁移
 * - 多次调用只会执行一次
 */
export function ensureDbReady() {
  if (ensured) return;
  ensured = true;
  try {
    const row = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1",
      )
      .get();
    if (!row) {
      runMigrations();
    }
  } catch {
    // ignore: let callers handle real errors
  }
}

/**
 * 初始化 FTS5 虚拟表与同步触发器（需在 contracts 表创建后执行）
 */
export function initFTS5() {
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS contracts_fts USING fts5(
      contract_no,
      title,
      party_company,
      party_person,
      party_contact,
      subject,
      content='contracts',
      content_rowid='id'
    );
  `);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS contracts_ai AFTER INSERT ON contracts BEGIN
      INSERT INTO contracts_fts(rowid, contract_no, title, party_company, party_person, party_contact, subject)
      VALUES (new.id, new.contract_no, new.title, new.party_company, new.party_person, new.party_contact, new.subject);
    END;

    CREATE TRIGGER IF NOT EXISTS contracts_ad AFTER DELETE ON contracts BEGIN
      DELETE FROM contracts_fts WHERE rowid = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS contracts_au AFTER UPDATE ON contracts BEGIN
      DELETE FROM contracts_fts WHERE rowid = old.id;
      INSERT INTO contracts_fts(rowid, contract_no, title, party_company, party_person, party_contact, subject)
      VALUES (new.id, new.contract_no, new.title, new.party_company, new.party_person, new.party_contact, new.subject);
    END;
  `);
}

/**
 * 运行 Drizzle 迁移并初始化 FTS5
 */
export function runMigrations() {
  const migrationsFolder = path.join(process.cwd(), 'lib/db/migrations');
  migrate(db, { migrationsFolder });
  initFTS5();
}
