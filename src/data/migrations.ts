// This small interface lets migration tests use real SQLite without a native runtime.
export interface MigrationDatabase {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
  withExclusiveTransactionAsync(task: (transaction: MigrationDatabase) => Promise<void>): Promise<void>;
}

export const SCHEMA_VERSION = 1;

export async function migrateDatabase(database: MigrationDatabase): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const row = await transaction.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    const version = row?.user_version ?? 0;
    if (version > SCHEMA_VERSION) {
      throw new Error('This data was created by a newer version of Form. Update the app to open it.');
    }
    if (version < 1) {
      await transaction.execAsync(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        INSERT INTO settings (key, value) VALUES ('weight_unit', 'lb');
        PRAGMA user_version = 1;
      `);
    }
  });
}
