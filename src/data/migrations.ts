 // This small interface lets migration tests use real SQLite without a native runtime.
export interface MigrationDatabase {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
  withExclusiveTransactionAsync(task: (transaction: MigrationDatabase) => Promise<void>): Promise<void>;
}

export const SCHEMA_VERSION = 2;

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
    if (version < 2) {
      await transaction.execAsync(`
        CREATE TABLE exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 120),
          loading TEXT NOT NULL CHECK(loading IN ('total', 'per_hand', 'machine', 'bodyweight')),
          muscle_group TEXT NOT NULL DEFAULT '',
          archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0, 1))
        );
        CREATE TABLE routine_days (
          weekday INTEGER PRIMARY KEY CHECK(weekday BETWEEN 1 AND 7),
          current_version_id INTEGER REFERENCES routine_versions(id)
        );
        CREATE TABLE routine_versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          weekday INTEGER NOT NULL REFERENCES routine_days(weekday),
          name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
          warmup TEXT NOT NULL DEFAULT '',
          is_rest INTEGER NOT NULL CHECK(is_rest IN (0, 1)),
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
        CREATE TABLE planned_exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version_id INTEGER NOT NULL REFERENCES routine_versions(id),
          exercise_id INTEGER NOT NULL REFERENCES exercises(id),
          position INTEGER NOT NULL CHECK(position >= 0),
          sets INTEGER NOT NULL CHECK(sets BETWEEN 1 AND 100),
          reps_min INTEGER NOT NULL CHECK(reps_min BETWEEN 1 AND 1000),
          reps_max INTEGER NOT NULL CHECK(reps_max BETWEEN reps_min AND 1000),
          weight REAL CHECK(weight IS NULL OR weight BETWEEN 0 AND 100000),
          weight_unit TEXT NOT NULL CHECK(weight_unit IN ('lb', 'kg')),
          UNIQUE(version_id, position)
        );
        CREATE INDEX routine_versions_weekday ON routine_versions(weekday);
        CREATE INDEX planned_exercises_exercise ON planned_exercises(exercise_id);
        INSERT INTO routine_days (weekday) VALUES (1), (2), (3), (4), (5), (6), (7);
        INSERT INTO routine_versions (weekday, name, is_rest) VALUES (7, 'Rest', 1);
        UPDATE routine_days SET current_version_id = (SELECT id FROM routine_versions WHERE weekday = 7) WHERE weekday = 7;
        INSERT INTO exercises (name, loading, muscle_group) VALUES
          ('Barbell bench press', 'total', 'Chest'),
          ('Incline dumbbell curl', 'per_hand', 'Biceps'),
          ('Smith machine squat', 'total', 'Legs'),
          ('Lat pulldown', 'machine', 'Back'),
          ('Dumbbell shoulder press', 'per_hand', 'Shoulders'),
          ('Barbell squat', 'total', 'Legs'),
          ('Seated cable row', 'machine', 'Back'),
          ('Pull-up', 'bodyweight', 'Back');
        PRAGMA user_version = 2;
      `);
    }
  });
}
