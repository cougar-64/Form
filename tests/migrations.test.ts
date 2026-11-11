import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateDatabase, SCHEMA_VERSION, type MigrationDatabase } from '../src/data/migrations.ts';

function adapter(db: DatabaseSync): MigrationDatabase {
  return {
    async execAsync(sql) { db.exec(sql); },
    async getFirstAsync<T>(sql: string) { return (db.prepare(sql).get() as T | undefined) ?? null; },
    async withExclusiveTransactionAsync(task) {
      db.exec('BEGIN IMMEDIATE');
      try {
        await task(adapter(db));
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

test('fresh setup defaults to pounds and preserves a changed preference after reopening and migration', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'form-test-'));
  const path = join(directory, 'form.db');
  let db = new DatabaseSync(path);
  try {
    await migrateDatabase(adapter(db));
    assert.equal(db.prepare("SELECT value FROM settings WHERE key = 'weight_unit'").get()?.value, 'lb');
    db.prepare("UPDATE settings SET value = 'kg' WHERE key = 'weight_unit'").run();
    db.close();
    db = new DatabaseSync(path);
    await migrateDatabase(adapter(db));
    assert.equal(db.prepare("SELECT value FROM settings WHERE key = 'weight_unit'").get()?.value, 'kg');
    assert.equal(db.prepare('PRAGMA user_version').get()?.user_version, SCHEMA_VERSION);
    assert.equal(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys, 1);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a newer database is rejected without changing its data or version', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec("CREATE TABLE preserved (value TEXT); INSERT INTO preserved VALUES ('keep'); PRAGMA user_version = 99;");
    await assert.rejects(migrateDatabase(adapter(db)), /newer version/);
    assert.equal(db.prepare('PRAGMA user_version').get()?.user_version, 99);
    assert.equal(db.prepare('SELECT value FROM preserved').get()?.value, 'keep');
  } finally { db.close(); }
});

test('a failed migration rolls back both schema and version', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    const database = adapter(db);
    const original = database.withExclusiveTransactionAsync;
    database.withExclusiveTransactionAsync = (task) => original(async (transaction) => {
      await task(transaction);
      throw new Error('Simulated interruption before commit');
    });
    await assert.rejects(migrateDatabase(database), /Simulated interruption/);
    assert.equal(db.prepare('PRAGMA user_version').get()?.user_version, 0);
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name = 'settings'").get(), undefined);
  } finally { db.close(); }
});
