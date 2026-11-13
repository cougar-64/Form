import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

// Run the production database actions against real SQLite. Only the async driver
// methods used by those actions are adapted; no application SQL is duplicated.
export function sqliteAdapter(db: DatabaseSync): SQLiteDatabase {
  const adapter = {
    async execAsync(sql: string) { db.exec(sql); },
    async getFirstAsync<T>(sql: string, ...values: SQLInputValue[]) {
      return (db.prepare(sql).get(...values) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, ...values: SQLInputValue[]) {
      return db.prepare(sql).all(...values) as T[];
    },
    async runAsync(sql: string, ...values: SQLInputValue[]) {
      const result = db.prepare(sql).run(...values);
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async withExclusiveTransactionAsync(task: (transaction: SQLiteDatabase) => Promise<void>) {
      db.exec('BEGIN IMMEDIATE');
      try {
        await task(sqliteAdapter(db));
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return adapter as SQLiteDatabase;
}
