import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { SQLiteDatabase } from 'expo-sqlite';
import { migrateDatabase } from '../src/data/migrations.ts';
import { getDatedPlan, getWeek, initializeSchedule } from '../src/data/schedule.ts';
import { listExercises, loadWorkout, saveWorkout } from '../src/data/workouts.ts';
import { sqliteAdapter } from './sqlite.ts';

async function saveTemplate(db: SQLiteDatabase, day: number, today: string, name: string, weight = '135') {
  const exercise = (await listExercises(db, 'Barbell bench press'))[0]!;
  return saveWorkout(db, {
    ...await loadWorkout(db, day), name, rest: false, warmup: 'Light warmup',
    exercises: [{ ...exercise, key: 'bench', sets: '3', reps: '8-12', weight, unit: 'lb' }],
  }, today);
}

test('schedule starts once in local date, has no pre-start occurrences, and keeps rest distinct from unplanned', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await migrateDatabase(db);
    await initializeSchedule(db, '2026-11-13');
    await initializeSchedule(db, '2026-11-20');
    const week = await getWeek(db, '2026-11-13', '2026-11-13');
    assert.equal(week.startDate, '2026-11-13');
    assert.ok(week.days.slice(0, 4).every((day) => day.beforeStart && day.id === null));
    assert.equal(week.days[4]?.name, null);
    assert.equal(week.days[4]?.rest, false);
    assert.equal(week.days[6]?.rest, true);
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM workout_occurrences WHERE scheduled_date < '2026-11-13'").get()?.n, 0);
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM schedule_rules').get()?.n, 7);
  } finally { raw.close(); }
});

test('weekly plans repeat with stable dated identities and preserve planned details', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await migrateDatabase(db);
    await initializeSchedule(db, '2026-11-09');
    const version = await saveTemplate(db, 1, '2026-11-09', 'Push');
    const first = await getWeek(db, '2026-11-09', '2026-11-09');
    const again = await getWeek(db, '2026-11-09', '2026-11-09');
    const next = await getWeek(db, '2026-11-16', '2026-11-09');
    assert.deepEqual(first.days.map((day) => day.id), again.days.map((day) => day.id));
    assert.notEqual(first.days[0]?.id, next.days[0]?.id);
    assert.equal(next.days[0]?.versionId, version);
    assert.equal(next.days[0]?.warmup, 'Light warmup');
    assert.equal(next.days[0]?.exercises[0]?.weight, 135);
    assert.equal(next.days[0]?.exercises[0]?.reps_max, 12);
    assert.equal(first.days[6]?.rest, true);
    assert.equal(next.days[6]?.rest, true);
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM workout_occurrences').get()?.n, 14);
  } finally { raw.close(); }
});

test('upgrading a version 2 database captures existing templates without changing them or the saved unit', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await migrateDatabase(db);
    const version = await saveTemplate(db, 1, '2026-11-09', 'Existing Push');
    raw.exec("DROP TABLE actual_sets; DROP TABLE session_exercises; DROP TABLE workout_sessions; DROP TABLE workout_occurrences; DROP TABLE schedule_rules; DROP TABLE schedule_config; UPDATE settings SET value = 'kg' WHERE key = 'weight_unit'; PRAGMA user_version = 2;");
    await migrateDatabase(db);
    await initializeSchedule(db, '2026-11-13');
    const nextMonday = await getDatedPlan(db, '2026-11-16', '2026-11-13');
    assert.equal(nextMonday.versionId, version);
    assert.equal(nextMonday.name, 'Existing Push');
    assert.equal(raw.prepare('SELECT value FROM settings').get()?.value, 'kg');
    assert.equal((await getDatedPlan(db, '2026-11-09', '2026-11-13')).beforeStart, true);
  } finally { raw.close(); }
});

test('later setup and rest-day changes do not create workouts retroactively', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await migrateDatabase(db);
    await initializeSchedule(db, '2026-11-09');
    await saveTemplate(db, 3, '2026-11-18', 'Wednesday Legs');
    assert.equal((await getDatedPlan(db, '2026-11-11', '2026-11-18')).name, null);
    const future = await getDatedPlan(db, '2026-11-25', '2026-11-18');
    assert.equal(future.name, 'Wednesday Legs');
    const current = await loadWorkout(db, 3);
    await saveWorkout(db, { ...current, name: 'Rest', rest: true, exercises: [] }, '2026-11-19');
    assert.equal((await getDatedPlan(db, '2026-11-18', '2026-11-19')).name, 'Wednesday Legs');
    assert.equal((await getDatedPlan(db, '2026-11-25', '2026-11-19')).rest, true);
    assert.equal((await getDatedPlan(db, '2026-11-25', '2026-11-19')).id, future.id);
  } finally { raw.close(); }
});

test('changes preserve seen and unseen past plans and refresh already-viewed future dates for only that weekday', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await migrateDatabase(db);
    await initializeSchedule(db, '2026-11-02');
    const old = await saveTemplate(db, 1, '2026-11-02', 'Push', '135');
    const thursday = await saveTemplate(db, 4, '2026-11-02', 'Push', '100');
    const seen = await getDatedPlan(db, '2026-11-02', '2026-11-02');
    const future = await getDatedPlan(db, '2026-11-23', '2026-11-02');
    const current = await saveTemplate(db, 1, '2026-11-16', 'Push A', '145');
    assert.equal((await getDatedPlan(db, '2026-11-02', '2026-11-16')).id, seen.id);
    assert.equal((await getDatedPlan(db, '2026-11-02', '2026-11-16')).versionId, old);
    assert.equal((await getDatedPlan(db, '2026-11-09', '2026-11-16')).versionId, old); // never viewed before edit
    assert.equal((await getDatedPlan(db, '2026-11-16', '2026-11-16')).versionId, current);
    assert.equal((await getDatedPlan(db, '2026-11-23', '2026-11-16')).id, future.id);
    assert.equal((await getDatedPlan(db, '2026-11-23', '2026-11-16')).exercises[0]?.weight, 145);
    assert.equal((await getDatedPlan(db, '2026-11-19', '2026-11-16')).versionId, thursday);
    // Multiple edits today select the latest plan without duplicating a dated occurrence.
    const last = await saveTemplate(db, 1, '2026-11-16', 'Push A revised', '150');
    assert.equal((await getDatedPlan(db, '2026-11-16', '2026-11-16')).versionId, last);
    assert.equal((await getDatedPlan(db, '2026-11-09', '2026-11-16')).exercises[0]?.weight, 135);
  } finally { raw.close(); }
});

test('a failed occurrence refresh rolls back template, schedule rule, and all future dated changes', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    const db = sqliteAdapter(raw);
    await migrateDatabase(db);
    await initializeSchedule(db, '2026-11-09');
    const initial = await saveTemplate(db, 1, '2026-11-09', 'Push');
    await getDatedPlan(db, '2026-11-16', '2026-11-09');
    raw.exec("CREATE TRIGGER refuse_update BEFORE UPDATE ON workout_occurrences BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END;");
    await assert.rejects(saveTemplate(db, 1, '2026-11-10', 'Changed'), /simulated write failure/);
    assert.equal((await loadWorkout(db, 1)).versionId, initial);
    assert.equal(raw.prepare('SELECT routine_version_id FROM workout_occurrences').get()?.routine_version_id, initial);
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM schedule_rules WHERE effective_from = '2026-11-10'").get()?.n, 0);
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM routine_versions').get()?.n, 2);
  } finally { raw.close(); }
});

test('schedule, occurrence IDs and template history persist after reopening and a year boundary', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'form-calendar-'));
  const path = join(directory, 'form.db');
  let raw = new DatabaseSync(path);
  try {
    let db = sqliteAdapter(raw);
    await migrateDatabase(db);
    await initializeSchedule(db, '2026-12-28');
    const version = await saveTemplate(db, 5, '2026-12-28', 'Friday');
    const plan = await getDatedPlan(db, '2027-01-01', '2026-12-28');
    raw.close();
    raw = new DatabaseSync(path);
    db = sqliteAdapter(raw);
    await migrateDatabase(db);
    await initializeSchedule(db, '2027-01-02');
    const week = await getWeek(db, '2027-01-01', '2027-01-02');
    assert.equal(week.startDate, '2026-12-28');
    assert.equal(week.days[4]?.date, '2027-01-01');
    assert.equal(week.days[4]?.id, plan.id);
    assert.equal(week.days[4]?.versionId, version);
    await assert.rejects(getDatedPlan(db, '2027-02-29', '2027-01-02'), /valid calendar date/);
  } finally { raw.close(); rmSync(directory, { recursive: true, force: true }); }
});
