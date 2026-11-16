import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SQLiteDatabase } from 'expo-sqlite';
import { sqliteAdapter } from './sqlite.ts';
import { migrateDatabase } from '../src/data/migrations.ts';
import { initializeSchedule, getDatedPlan } from '../src/data/schedule.ts';
import { weekday } from '../src/data/dates.ts';
import { listExercises, loadWorkout, saveWorkout } from '../src/data/workouts.ts';
import { addSessionExercise, discardSetDraft, finishWorkout, getHomeSession, getSessionForOccurrence, IncompleteWorkoutError,
  loadSession, loadSessionExercise, previousPerformance, saveActualSets, saveSetDraft, startWorkout, type DraftSet } from '../src/data/sessions.ts';
import { enqueueSetEntryWrite, waitForSetEntryWrites } from '../src/ui/setEntryQueue.ts';

const now = (date: string, time = '12:00:00') => new Date(`${date}T${time}`);
const set = (key: string, weight = '135', reps = '8'): DraftSet => ({ key, weight, reps, unit: 'lb' });

async function template(db: SQLiteDatabase, date: string, effective = date) {
  const bench = (await listExercises(db, 'Barbell bench press'))[0]!;
  const pullup = (await listExercises(db, 'Pull-up'))[0]!;
  return saveWorkout(db, { ...await loadWorkout(db, weekday(date)), name: 'Training', rest: false, warmup: 'Light warmup', exercises: [
    { ...bench, key: 'bench', sets: '2', reps: '8-12', weight: '135', unit: 'lb' },
    { ...pullup, key: 'pullup', sets: '1', reps: '6', weight: '', unit: 'lb' },
  ] }, effective);
}

async function setup(db: SQLiteDatabase, date = '2026-11-09') {
  await migrateDatabase(db);
  await initializeSchedule(db, date);
  await template(db, date);
}

async function record(db: SQLiteDatabase, id: number, rows: DraftSet[]) {
  const exercise = await loadSessionExercise(db, id);
  const revision = await saveSetDraft(db, id, rows, exercise.revision);
  await saveActualSets(db, id, revision);
}

test('Start is explicit and idempotent; exercises log out of order and never auto-finish', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await setup(db);
    assert.equal(await getHomeSession(db, '2026-11-09'), null);
    const id = await startWorkout(db, now('2026-11-09'));
    assert.equal(await startWorkout(db, now('2026-11-09')), id);
    const session = await loadSession(db, id);
    assert.equal(session.exercises.length, 2);
    await record(db, session.exercises[1]!.id, [set('body', '', '6')]);
    await record(db, session.exercises[0]!.id, [set('one'), set('two'), set('extra', '145', '1')]);
    assert.equal((await loadSession(db, id)).status, 'in_progress');
    assert.equal((await getDatedPlan(db, '2026-11-09', '2026-11-09')).sessionStatus, 'in_progress');
    await finishWorkout(db, id, false, now('2026-11-09', '13:00:00'));
    assert.equal((await loadSession(db, id)).status, 'completed');
    assert.equal((await getDatedPlan(db, '2026-11-09', '2026-11-09')).sessionStatus, 'completed');
    assert.equal(await startWorkout(db, now('2026-11-09')), id);
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM workout_sessions').get()?.n, 1);
  } finally { raw.close(); }
});

test('Start freezes routine context against same-day and future template edits', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await setup(db);
    const plan = await getDatedPlan(db, '2026-11-09', '2026-11-09');
    const id = await startWorkout(db, now('2026-11-09'));
    const edited = await loadWorkout(db, 1);
    edited.name = 'Changed template'; edited.warmup = 'Different warmup'; edited.exercises[0]!.weight = '155';
    const version = await saveWorkout(db, edited, '2026-11-09');
    assert.equal((await getDatedPlan(db, '2026-11-09', '2026-11-09')).versionId, plan.versionId);
    assert.equal((await getDatedPlan(db, '2026-11-16', '2026-11-09')).versionId, version);
    const session = await loadSession(db, id);
    assert.equal(session.name, 'Training'); assert.equal(session.warmup, 'Light warmup');
    assert.equal(session.exercises[0]?.planned_weight, 135);
    raw.exec("UPDATE exercises SET name = 'Renamed catalog item' WHERE name = 'Barbell bench press'");
    assert.equal((await loadSession(db, id)).exercises[0]?.name, 'Barbell bench press');
  } finally { raw.close(); }
});

test('drafts and actual values survive reopen independently, with precise loads and stable saved-set identities', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'form-session-'));
  const path = join(directory, 'form.db');
  let raw = new DatabaseSync(path);
  try {
    let db = sqliteAdapter(raw);
    await setup(db);
    const id = await startWorkout(db, now('2026-11-09'));
    const exercise = (await loadSession(db, id)).exercises[0]!;
    await record(db, exercise.id, [{ ...set('saved', '25.125', '8'), unit: 'kg' }]);
    const saved = await loadSessionExercise(db, exercise.id);
    await saveSetDraft(db, exercise.id, [set('saved', '2.', '')], saved.revision);
    raw.close(); raw = new DatabaseSync(path); db = sqliteAdapter(raw);
    await migrateDatabase(db);
    const restored = await loadSessionExercise(db, exercise.id);
    assert.equal(restored.draft?.[0]?.weight, '2.');
    assert.equal(restored.draft?.[0]?.reps, '');
    assert.equal(restored.actual[0]?.weight_milli, 25125);
    assert.equal(restored.actual[0]?.unit, 'kg');
    await assert.rejects(saveActualSets(db, exercise.id, restored.revision), /whole reps/);
    assert.equal((await loadSessionExercise(db, exercise.id)).actual[0]?.weight_milli, 25125);
    await record(db, exercise.id, [set('saved', '27.5', '9'), set('extra', '30', '1')]);
    const updated = await loadSessionExercise(db, exercise.id);
    assert.equal(updated.actual[0]?.id, saved.actual[0]?.id);
    assert.equal(updated.actual[0]?.weight_milli, 27500);
    await record(db, exercise.id, [set('extra', '30', '1')]);
    assert.equal((await loadSessionExercise(db, exercise.id)).actual.length, 1);
    assert.equal((await loadSession(db, id)).status, 'in_progress');
  } finally { raw.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('Finish blocks pending drafts and requires explicit confirmation for partial workouts', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await setup(db);
    const id = await startWorkout(db, now('2026-11-09'));
    const exercise = (await loadSession(db, id)).exercises[0]!;
    const revision = await saveSetDraft(db, exercise.id, [set('draft')], exercise.revision);
    await assert.rejects(finishWorkout(db, id, true), /Save or discard/);
    await discardSetDraft(db, exercise.id, revision);
    await assert.rejects(finishWorkout(db, id), IncompleteWorkoutError);
    assert.equal((await loadSession(db, id)).status, 'in_progress');
    await finishWorkout(db, id, true, now('2026-11-09', '13:00:00'));
    const finished = await loadSession(db, id);
    await record(db, exercise.id, [set('correction')]);
    const corrected = await loadSession(db, id);
    assert.equal(corrected.status, 'completed');
    assert.equal(corrected.finished_at, finished.finished_at);
    assert.equal(corrected.exercises[0]?.actual.length, 1);
  } finally { raw.close(); }
});

test('a workout crossing midnight resumes with its original date and cannot start a second active session', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await setup(db, '2026-11-13');
    await template(db, '2026-11-14', '2026-11-13');
    const id = await startWorkout(db, now('2026-11-13', '23:59:00'));
    assert.equal(await startWorkout(db, now('2026-11-14', '00:01:00')), id);
    assert.equal((await getHomeSession(db, '2026-11-14'))?.performed_date, '2026-11-13');
    await finishWorkout(db, id, true, now('2026-11-14', '00:02:00'));
    assert.equal((await loadSession(db, id)).performed_date, '2026-11-13');
    const next = await startWorkout(db, now('2026-11-14', '12:00:00'));
    assert.notEqual(next, id);
    assert.equal((await getSessionForOccurrence(db, '2026-11-13'))?.id, id);
  } finally { raw.close(); }
});

test('previous performance selects the latest earlier actual session, ignoring bests and pending corrections', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await setup(db);
    await template(db, '2026-11-10', '2026-11-09');
    const first = await startWorkout(db, now('2026-11-09'));
    const e1 = (await loadSession(db, first)).exercises[0]!;
    await record(db, e1.id, [set('best', '200', '1')]);
    await finishWorkout(db, first, true);
    const second = await startWorkout(db, now('2026-11-10'));
    const e2 = (await loadSession(db, second)).exercises[0]!;
    assert.equal(e2.previous?.sets[0]?.weight_milli, 200000);
    await record(db, e2.id, [set('recent', '100', '8')]);
    await finishWorkout(db, second, true);
    const after = await loadSessionExercise(db, e2.id);
    await saveSetDraft(db, e2.id, [set('recent', '999', '1')], after.revision);
    const previous = await previousPerformance(db, e1.exercise_id, '2026-11-11');
    assert.equal(previous?.date, '2026-11-10');
    assert.equal(previous?.sets[0]?.weight_milli, 100000);
  } finally { raw.close(); }
});

test('additional exercises affect only the session; draft edits cannot silently overwrite another editor', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await setup(db);
    const templateBefore = await loadWorkout(db, 1);
    const id = await startWorkout(db, now('2026-11-09'));
    const curl = (await listExercises(db, 'Incline dumbbell curl'))[0]!;
    await addSessionExercise(db, id, curl.id);
    const session = await loadSession(db, id);
    assert.equal(session.exercises.length, 3);
    assert.equal(session.exercises[2]?.planned_sets, null);
    assert.equal((await loadWorkout(db, 1)).versionId, templateBefore.versionId);
    const extra = session.exercises[2]!;
    await saveSetDraft(db, extra.id, [set('draft', '25', '8')], extra.revision);
    await assert.rejects(saveSetDraft(db, extra.id, [set('stale', '30', '8')], extra.revision), /changed elsewhere/);
    assert.equal((await loadSessionExercise(db, extra.id)).draft?.[0]?.weight, '25');
  } finally { raw.close(); }
});

test('actual validation rejects incomplete/invalid loads and reps without replacing saved performance', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await setup(db);
    const id = await startWorkout(db, now('2026-11-09'));
    const session = await loadSession(db, id);
    const exercise = session.exercises[0]!;
    await record(db, exercise.id, [set('valid')]);
    for (const row of [set('invalid', '-5'), set('invalid', ''), set('invalid', '1e3'), set('invalid', '100000.001'), set('invalid', '1', '0'), set('invalid', '1', '1.5')]) {
      const current = await loadSessionExercise(db, exercise.id);
      const revision = await saveSetDraft(db, exercise.id, [row], current.revision);
      await assert.rejects(saveActualSets(db, exercise.id, revision));
      assert.equal((await loadSessionExercise(db, exercise.id)).actual[0]?.weight_milli, 135000);
    }
    const bodyweight = session.exercises[1]!;
    const revision = await saveSetDraft(db, bodyweight.id, [set('body', '20', '6')], bodyweight.revision);
    await assert.rejects(saveActualSets(db, bodyweight.id, revision), /bodyweight/);
  } finally { raw.close(); }
});

test('failed Start and set writes roll back completely', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await setup(db);
    raw.exec("CREATE TRIGGER refuse_start BEFORE INSERT ON session_exercises WHEN NEW.position = 1 BEGIN SELECT RAISE(ABORT, 'start failure'); END;");
    await assert.rejects(startWorkout(db, now('2026-11-09')), /start failure/);
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM workout_sessions').get()?.n, 0);
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM workout_occurrences').get()?.n, 0);
    raw.exec('DROP TRIGGER refuse_start');
    const id = await startWorkout(db, now('2026-11-09'));
    const exercise = (await loadSession(db, id)).exercises[0]!;
    await record(db, exercise.id, [set('keep')]);
    const current = await loadSessionExercise(db, exercise.id);
    const revision = await saveSetDraft(db, exercise.id, [set('keep', '150'), set('fail')], current.revision);
    raw.exec("CREATE TRIGGER refuse_set BEFORE INSERT ON actual_sets WHEN NEW.position = 1 BEGIN SELECT RAISE(ABORT, 'set failure'); END;");
    await assert.rejects(saveActualSets(db, exercise.id, revision), /set failure/);
    const restored = await loadSessionExercise(db, exercise.id);
    assert.equal(restored.actual.length, 1); assert.equal(restored.actual[0]?.weight_milli, 135000);
    assert.equal(restored.draft?.length, 2);
  } finally { raw.close(); }
});

test('version 3 upgrade keeps routine, occurrence identity and preferences; rest days cannot start', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await setup(db);
    const before = await getDatedPlan(db, '2026-11-09', '2026-11-09');
    raw.exec("DROP TABLE actual_sets; DROP TABLE session_exercises; DROP TABLE workout_sessions; ALTER TABLE workout_occurrences DROP COLUMN plan_locked; UPDATE settings SET value = 'kg' WHERE key = 'weight_unit'; PRAGMA user_version = 3;");
    await migrateDatabase(db);
    const after = await getDatedPlan(db, '2026-11-09', '2026-11-09');
    assert.equal(after.id, before.id); assert.equal(after.versionId, before.versionId);
    assert.equal(raw.prepare('SELECT value FROM settings').get()?.value, 'kg');
    await assert.rejects(startWorkout(db, now('2026-11-15')), /Plan a workout/);
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM workout_sessions').get()?.n, 0);
  } finally { raw.close(); }
});

test('inline logging skips blank planned slots while retaining set numbers and stable saved IDs', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await setup(db);
    const session = await loadSession(db, await startWorkout(db, now('2026-11-09')));
    const exercise = session.exercises[0]!;
    const rows = [set('blank-one', '', ''), set('logged-two', '135', '8'), set('blank-three', '', '')];
    let revision = await saveSetDraft(db, exercise.id, rows, exercise.revision);
    await saveActualSets(db, exercise.id, revision, true);
    const first = await loadSessionExercise(db, exercise.id);
    assert.equal(first.actual.length, 1);
    assert.equal(first.actual[0]?.position, 1);
    assert.equal(first.actual[0]?.weight_milli, 135000);
    assert.equal(first.draft, null);
    revision = await saveSetDraft(db, exercise.id, [rows[0]!, set('logged-two', '140', '9'), rows[2]!], first.revision);
    await saveActualSets(db, exercise.id, revision, true);
    const second = await loadSessionExercise(db, exercise.id);
    assert.equal(second.actual[0]?.id, first.actual[0]?.id);
    assert.equal(second.actual[0]?.position, 1);
    assert.equal((await previousPerformance(db, exercise.exercise_id, '2026-11-10'))?.sets[0]?.position, 1);
    assert.equal((await loadSession(db, session.id)).status, 'in_progress');
  } finally { raw.close(); }
});

test('inline logging rejects partly filled rows and clears actual sets only on explicit save', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await setup(db);
    const session = await loadSession(db, await startWorkout(db, now('2026-11-09')));
    const exercise = session.exercises[0]!;
    await record(db, exercise.id, [set('saved')]);
    let current = await loadSessionExercise(db, exercise.id);
    let revision = await saveSetDraft(db, exercise.id, [set('saved'), set('partial', '145', ''), set('blank', '', '')], current.revision);
    await assert.rejects(saveActualSets(db, exercise.id, revision, true), /whole reps/);
    current = await loadSessionExercise(db, exercise.id);
    assert.equal(current.actual.length, 1);
    assert.equal(current.draft?.length, 3);
    revision = await saveSetDraft(db, exercise.id, [set('empty', '', '')], current.revision);
    assert.equal((await loadSessionExercise(db, exercise.id)).actual.length, 1);
    await saveActualSets(db, exercise.id, revision, true);
    assert.equal((await loadSessionExercise(db, exercise.id)).actual.length, 0);
    const body = session.exercises[1]!;
    revision = await saveSetDraft(db, body.id, [set('empty-body', '', ''), set('body', '', '7')], body.revision);
    await saveActualSets(db, body.id, revision, true);
    assert.equal((await loadSessionExercise(db, body.id)).actual[0]?.position, 1);
    assert.equal((await loadSessionExercise(db, body.id)).actual[0]?.weight_milli, null);
  } finally { raw.close(); }
});

test('inline editors serialize writes across exercises and a failed save does not block other editors', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await setup(db);
    const session = await loadSession(db, await startWorkout(db, now('2026-11-09')));
    const first = session.exercises[0]!;
    const second = session.exercises[1]!;
    const writes = await Promise.allSettled([
      enqueueSetEntryWrite(async () => {
        const revision = await saveSetDraft(db, first.id, [set('invalid', '135', '')], first.revision);
        await saveActualSets(db, first.id, revision, true);
      }),
      enqueueSetEntryWrite(async () => {
        const revision = await saveSetDraft(db, second.id, [set('body', '', '8')], second.revision);
        await saveActualSets(db, second.id, revision, true);
      }),
    ]);
    await waitForSetEntryWrites();
    assert.equal(writes[0]?.status, 'rejected');
    assert.equal(writes[1]?.status, 'fulfilled');
    assert.equal((await loadSessionExercise(db, first.id)).draft?.[0]?.weight, '135');
    assert.equal((await loadSessionExercise(db, second.id)).actual[0]?.reps, 8);
  } finally { raw.close(); }
});
