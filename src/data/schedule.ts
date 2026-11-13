import type { SQLiteDatabase } from 'expo-sqlite';
import type { Loading, Unit, WorkoutDatabase } from './workouts.ts';
import { assertDate, localDate, weekday, weekDates } from './dates.ts';

type ScheduleTransaction = Pick<SQLiteDatabase, 'getFirstAsync' | 'getAllAsync' | 'runAsync'>;
export type ScheduledExercise = {
  exercise_id: number; name: string; loading: Loading; muscle_group: string;
  sets: number; reps_min: number; reps_max: number; weight: number | null; weight_unit: Unit;
};
export type DatedPlan = {
  id: number | null; date: string; weekday: number; versionId: number | null;
  beforeStart: boolean; name: string | null; warmup: string; rest: boolean;
  exercises: ScheduledExercise[];
};
export type CalendarWeek = { startDate: string; days: DatedPlan[] };

// Initialize in local time at app startup, never in SQLite's UTC date('now').
export async function ensureSchedule(tx: ScheduleTransaction, today: string): Promise<string> {
  assertDate(today);
  const existing = await tx.getFirstAsync<{ start_date: string }>('SELECT start_date FROM schedule_config WHERE id = 1');
  if (existing) return existing.start_date;
  await tx.runAsync('INSERT INTO schedule_config (id, start_date) VALUES (1, ?)', today);
  await tx.runAsync(`
    INSERT INTO schedule_rules (weekday, effective_from, routine_version_id)
    SELECT weekday, ?, current_version_id FROM routine_days
  `, today);
  return today;
}

export async function initializeSchedule(db: WorkoutDatabase, today = localDate()): Promise<void> {
  await db.withExclusiveTransactionAsync(async (tx) => { await ensureSchedule(tx, today); });
}

// Called in the same transaction as a template save. Historical rules are kept
// even for dates that have never been displayed or materialized.
export async function recordRoutineChange(tx: ScheduleTransaction, day: number, versionId: number, today: string): Promise<void> {
  const start = await ensureSchedule(tx, today);
  const effective = today < start ? start : today;
  await tx.runAsync(`
    INSERT INTO schedule_rules (weekday, effective_from, routine_version_id) VALUES (?, ?, ?)
    ON CONFLICT(weekday, effective_from) DO UPDATE SET routine_version_id = excluded.routine_version_id
  `, day, effective, versionId);
  await tx.runAsync(`
    UPDATE workout_occurrences SET routine_version_id = (
      SELECT r.routine_version_id FROM schedule_rules r
      WHERE r.weekday = workout_occurrences.weekday AND r.effective_from <= workout_occurrences.scheduled_date
      ORDER BY r.effective_from DESC LIMIT 1
    ) WHERE weekday = ? AND scheduled_date >= ?
  `, day, effective);
}

async function readPlan(tx: ScheduleTransaction, date: string, today: string, start: string): Promise<DatedPlan> {
  const day = weekday(date);
  const empty: DatedPlan = { id: null, date, weekday: day, versionId: null, beforeStart: date < start, name: null, warmup: '', rest: false, exercises: [] };
  if (empty.beforeStart) return empty;
  let occurrence = await tx.getFirstAsync<{ id: number; routine_version_id: number | null }>(
    'SELECT id, routine_version_id FROM workout_occurrences WHERE scheduled_date = ?', date,
  );
  // Past snapshots stay fixed. Missing past snapshots are reconstructed using
  // the effective-dated rules, rather than today's template pointer.
  if (!occurrence || date >= today) {
    const rule = await tx.getFirstAsync<{ routine_version_id: number | null }>(`
      SELECT routine_version_id FROM schedule_rules WHERE weekday = ? AND effective_from <= ?
      ORDER BY effective_from DESC LIMIT 1
    `, day, date);
    await tx.runAsync(`
      INSERT INTO workout_occurrences (scheduled_date, weekday, routine_version_id) VALUES (?, ?, ?)
      ON CONFLICT(scheduled_date) DO UPDATE SET routine_version_id = excluded.routine_version_id
    `, date, day, rule?.routine_version_id ?? null);
    occurrence = await tx.getFirstAsync<{ id: number; routine_version_id: number | null }>(
      'SELECT id, routine_version_id FROM workout_occurrences WHERE scheduled_date = ?', date,
    );
  }
  if (!occurrence) throw new Error('Could not open the dated plan.');
  if (occurrence.routine_version_id === null) return { ...empty, id: occurrence.id };
  const version = await tx.getFirstAsync<{ name: string; warmup: string; is_rest: number }>(
    'SELECT name, warmup, is_rest FROM routine_versions WHERE id = ?', occurrence.routine_version_id,
  );
  if (!version) throw new Error('This dated plan refers to a missing routine.');
  const exercises = await tx.getAllAsync<ScheduledExercise>(`
    SELECT p.exercise_id, e.name, e.loading, e.muscle_group, p.sets, p.reps_min, p.reps_max, p.weight, p.weight_unit
    FROM planned_exercises p JOIN exercises e ON e.id = p.exercise_id WHERE p.version_id = ? ORDER BY p.position
  `, occurrence.routine_version_id);
  return { ...empty, id: occurrence.id, versionId: occurrence.routine_version_id, name: version.name, warmup: version.warmup, rest: version.is_rest === 1, exercises };
}

export async function getWeek(db: WorkoutDatabase, containing: string, today = localDate()): Promise<CalendarWeek> {
  const dates = weekDates(containing);
  assertDate(today);
  let result: CalendarWeek | undefined;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const startDate = await ensureSchedule(tx, today);
    const days: DatedPlan[] = [];
    for (const date of dates) days.push(await readPlan(tx, date, today, startDate));
    result = { startDate, days };
  });
  return result!;
}

export async function getDatedPlan(db: WorkoutDatabase, date: string, today = localDate()): Promise<DatedPlan> {
  assertDate(date);
  assertDate(today);
  let result: DatedPlan | undefined;
  await db.withExclusiveTransactionAsync(async (tx) => {
    result = await readPlan(tx, date, today, await ensureSchedule(tx, today));
  });
  return result!;
}
