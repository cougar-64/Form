import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateDatabase } from '../src/data/migrations.ts';
import { createExercise, listDays, listExercises, loadWorkout, saveWorkout, validateWorkout, type PlannedExercise } from '../src/data/workouts.ts';
import { sqliteAdapter } from './sqlite.ts';

function plan(exercise: Awaited<ReturnType<typeof createExercise>>, key = 'one'): PlannedExercise {
  return { ...exercise, key, sets: '3', reps: '8-12', weight: '25.5', unit: 'lb' };
}

test('v1 upgrade keeps settings; seeds seven independent days and catalog only once', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    raw.exec("CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL); INSERT INTO settings VALUES ('weight_unit', 'kg'); PRAGMA user_version = 1;");
    const db = sqliteAdapter(raw);
    await migrateDatabase(db);
    assert.equal(raw.prepare('SELECT value FROM settings').get()?.value, 'kg');
    const days = await listDays(db);
    assert.equal(days.length, 7);
    assert.ok(days.slice(0, 6).every((day) => day.name === null));
    assert.equal(days[6]?.is_rest, 1);
    const initial = (await listExercises(db)).length;
    await createExercise(db, 'Custom row', 'machine', 'Back');
    await migrateDatabase(db);
    assert.equal((await listExercises(db)).length, initial + 1);
    assert.equal((await loadWorkout(db, 7)).name, 'Rest');
  } finally { raw.close(); }
});

test('same-name Monday and Thursday workouts stay independent and prior versions survive edits', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await migrateDatabase(db);
    const curl = await createExercise(db, 'My incline curls', 'per_hand', 'Biceps');
    const monday = { ...await loadWorkout(db, 1), name: 'Push', warmup: 'Light warmup', exercises: [plan(curl)] };
    const firstMondayId = await saveWorkout(db, monday);
    const thursday = { ...await loadWorkout(db, 4), name: 'Push', exercises: [plan(curl)] };
    const thursdayId = await saveWorkout(db, thursday);
    const updated = await loadWorkout(db, 1);
    updated.name = 'Push A';
    updated.exercises[0]!.weight = '30';
    await saveWorkout(db, updated);
    assert.equal((await loadWorkout(db, 4)).versionId, thursdayId);
    assert.equal((await loadWorkout(db, 4)).exercises[0]?.weight, '25.5');
    assert.equal(raw.prepare('SELECT weight FROM planned_exercises WHERE version_id = ?').get(firstMondayId)?.weight, 25.5);
    assert.equal(raw.prepare('SELECT name FROM routine_versions WHERE id = ?').get(firstMondayId)?.name, 'Push');
    await assert.rejects(saveWorkout(db, monday), /changed elsewhere/);
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM routine_versions').get()?.n, 4);
  } finally { raw.close(); }
});

test('failed save rolls back version, exercises and current pointer together', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await migrateDatabase(db);
    const exercise = await createExercise(db, 'Cable fly', 'machine', 'Chest');
    const draft = { ...await loadWorkout(db, 2), name: 'Push', exercises: [plan(exercise), plan({ ...exercise, id: 99999 }, 'two')] };
    await assert.rejects(saveWorkout(db, draft), /no longer available/);
    assert.equal((await loadWorkout(db, 2)).versionId, null);
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM routine_versions').get()?.n, 1);
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM planned_exercises').get()?.n, 0);
  } finally { raw.close(); }
});

test('custom identity, ordered plans, bodyweight and units persist across file reopen', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'form-builder-'));
  const path = join(directory, 'form.db');
  let raw = new DatabaseSync(path);
  try {
    let db = sqliteAdapter(raw);
    await migrateDatabase(db);
    const dumbbell = await createExercise(db, 'My dumbbell row', 'per_hand', 'Back');
    const bodyweight = await createExercise(db, 'My pull-up', 'bodyweight', 'Back');
    await assert.rejects(createExercise(db, ' my DUMBBELL row ', 'total', ''), /already exists/);
    const draft = { ...await loadWorkout(db, 3), name: 'Pull', exercises: [
      { ...plan(bodyweight), weight: '', reps: '6', key: 'pullup' },
      { ...plan(dumbbell), unit: 'kg' as const },
    ] };
    await saveWorkout(db, draft);
    raw.close();
    raw = new DatabaseSync(path);
    db = sqliteAdapter(raw);
    await migrateDatabase(db);
    const loaded = await loadWorkout(db, 3);
    assert.deepEqual(loaded.exercises.map((e) => [e.id, e.reps, e.weight, e.unit]), [
      [bodyweight.id, '6', '', 'lb'], [dumbbell.id, '8-12', '25.5', 'kg'],
    ]);
    assert.equal((await listExercises(db, 'dumbbell row'))[0]?.id, dumbbell.id);
    const previousId = loaded.versionId;
    const restId = await saveWorkout(db, { ...loaded, rest: true, name: 'Rest', exercises: [] });
    assert.notEqual(previousId, restId);
    assert.equal((await loadWorkout(db, 3)).exercises.length, 0);
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM planned_exercises WHERE version_id = ?').get(previousId!)?.n, 2);
  } finally { raw.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('invalid plans and exercise names are rejected before saving', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await migrateDatabase(db);
    await assert.rejects(createExercise(db, '   ', 'total', ''), /exercise name/);
    const exercise = await createExercise(db, 'Custom bench', 'total', 'Chest');
    const base = { ...await loadWorkout(db, 1), name: 'Push', exercises: [plan(exercise)] };
    for (const change of [{ sets: '0' }, { sets: '1.5' }, { reps: '12-8' }, { reps: '0' }, { weight: '-5' }, { weight: 'NaN' }, { weight: '1e3' }]) {
      await assert.rejects(saveWorkout(db, { ...base, exercises: [{ ...base.exercises[0]!, ...change }] }));
    }
    assert.throws(() => validateWorkout({ ...base, name: ' ' }), /workout name/);
    assert.throws(() => validateWorkout({ ...base, exercises: [] }), /at least one/);
    assert.throws(() => validateWorkout({ ...base, rest: true }), /Remove planned/);
    assert.throws(() => validateWorkout({ ...base, weekday: 8 }), /weekday/);
    assert.equal((await loadWorkout(db, 1)).versionId, null);
  } finally { raw.close(); }
});
