import type { SQLiteDatabase } from 'expo-sqlite';
import { assertDate, localDate } from './dates.ts';
import { ensureSchedule, readPlanInTransaction } from './schedule.ts';
import type { Loading, Unit, WorkoutDatabase } from './workouts.ts';

export type DraftSet = { key: string; weight: string; reps: string; unit: Unit };
export type ActualSet = { id: number; client_key: string; position: number; weight_milli: number | null; reps: number; unit: Unit };
export type SessionSummary = { id: number; occurrence_id: number; routine_version_id: number; performed_date: string; name: string; warmup: string; started_at: string; started_timezone: string; status: 'in_progress' | 'completed'; finished_at: string | null };
export type PreviousPerformance = { date: string; sets: ActualSet[] };
export type SessionExercise = {
  id: number; session_id: number; exercise_id: number; name: string; loading: Loading; muscle_group: string; position: number;
  planned_sets: number | null; planned_reps_min: number | null; planned_reps_max: number | null; planned_weight: number | null; planned_unit: Unit;
  revision: number; draft: DraftSet[] | null; actual: ActualSet[]; previous: PreviousPerformance | null; performed_date: string;
};
export type Session = SessionSummary & { exercises: SessionExercise[] };
type Executor = Pick<SQLiteDatabase, 'getFirstAsync' | 'getAllAsync' | 'runAsync'>;
type ExerciseRow = Omit<SessionExercise, 'draft' | 'actual' | 'previous' | 'performed_date'> & { draft_json: string | null };

function validId(id: number) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Choose an existing workout or exercise.');
}

export async function startWorkout(db: WorkoutDatabase, now = new Date()): Promise<number> {
  const date = localDate(now);
  assertDate(date);
  const timestamp = now.toISOString();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'device local time';
  let id = 0;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const active = await tx.getFirstAsync<{ id: number }>("SELECT id FROM workout_sessions WHERE status = 'in_progress'");
    if (active) { id = active.id; return; }
    const existing = await tx.getFirstAsync<{ id: number }>('SELECT id FROM workout_sessions WHERE performed_date = ?', date);
    if (existing) { id = existing.id; return; }
    const plan = await readPlanInTransaction(tx, date, date, await ensureSchedule(tx, date));
    if (!plan.id || !plan.versionId || !plan.name || plan.rest) throw new Error('Plan a workout for today in Calendar before starting.');
    const result = await tx.runAsync(`
      INSERT INTO workout_sessions (occurrence_id, routine_version_id, performed_date, name, warmup, started_at, started_timezone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, plan.id, plan.versionId, date, plan.name, plan.warmup, timestamp, timezone);
    id = result.lastInsertRowId;
    for (const [position, exercise] of plan.exercises.entries()) {
      await tx.runAsync(`
        INSERT INTO session_exercises (session_id, exercise_id, name, loading, muscle_group, position,
          planned_sets, planned_reps_min, planned_reps_max, planned_weight, planned_unit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, id, exercise.exercise_id, exercise.name, exercise.loading, exercise.muscle_group, position,
      exercise.sets, exercise.reps_min, exercise.reps_max, exercise.weight, exercise.weight_unit);
    }
    await tx.runAsync('UPDATE workout_occurrences SET plan_locked = 1 WHERE id = ?', plan.id);
  });
  return id;
}

export async function getHomeSession(db: WorkoutDatabase, today = localDate()): Promise<SessionSummary | null> {
  assertDate(today);
  return db.getFirstAsync<SessionSummary>(`
    SELECT * FROM workout_sessions WHERE status = 'in_progress' OR performed_date = ?
    ORDER BY CASE WHEN status = 'in_progress' THEN 0 ELSE 1 END, id DESC LIMIT 1
  `, today);
}

export async function getSessionForOccurrence(db: WorkoutDatabase, date: string): Promise<SessionSummary | null> {
  assertDate(date);
  return db.getFirstAsync<SessionSummary>(`
    SELECT s.* FROM workout_sessions s JOIN workout_occurrences o ON o.id = s.occurrence_id WHERE o.scheduled_date = ?
  `, date);
}

export async function previousPerformance(db: Pick<SQLiteDatabase, 'getFirstAsync' | 'getAllAsync'>, exerciseId: number, beforeDate: string): Promise<PreviousPerformance | null> {
  assertDate(beforeDate);
  const row = await db.getFirstAsync<{ id: number; performed_date: string }>(`
    SELECT s.id, s.performed_date FROM workout_sessions s WHERE s.performed_date < ? AND EXISTS (
      SELECT 1 FROM session_exercises e JOIN actual_sets a ON a.session_exercise_id = e.id
      WHERE e.session_id = s.id AND e.exercise_id = ?
    ) ORDER BY s.performed_date DESC, s.started_at DESC, s.id DESC LIMIT 1
  `, beforeDate, exerciseId);
  if (!row) return null;
  const sets = await db.getAllAsync<ActualSet>(`
    SELECT a.* FROM actual_sets a JOIN session_exercises e ON e.id = a.session_exercise_id
    WHERE e.session_id = ? AND e.exercise_id = ? ORDER BY e.position, a.position
  `, row.id, exerciseId);
  return { date: row.performed_date, sets };
}

function parseDraft(value: unknown): DraftSet[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Use no more than 100 sets per exercise.');
  const keys = new Set<string>();
  return value.map((row) => {
    if (!row || typeof row !== 'object' || typeof row.key !== 'string' || !row.key || row.key.length > 80 || keys.has(row.key)
      || typeof row.weight !== 'string' || row.weight.length > 30 || typeof row.reps !== 'string' || row.reps.length > 30
      || (row.unit !== 'lb' && row.unit !== 'kg')) throw new Error('This set draft could not be read.');
    keys.add(row.key);
    return { key: row.key, weight: row.weight, reps: row.reps, unit: row.unit };
  });
}

export async function loadSessionExercise(db: WorkoutDatabase, id: number): Promise<SessionExercise> {
  validId(id);
  const row = await db.getFirstAsync<ExerciseRow>('SELECT * FROM session_exercises WHERE id = ?', id);
  if (!row) throw new Error('This session exercise could not be found.');
  const session = await db.getFirstAsync<SessionSummary>('SELECT * FROM workout_sessions WHERE id = ?', row.session_id);
  if (!session) throw new Error('This workout could not be found.');
  const actual = await db.getAllAsync<ActualSet>('SELECT * FROM actual_sets WHERE session_exercise_id = ? ORDER BY position', id);
  return { ...row, performed_date: session.performed_date, draft: row.draft_json === null ? null : parseDraft(JSON.parse(row.draft_json)), actual, previous: await previousPerformance(db, row.exercise_id, session.performed_date) };
}

export async function loadSession(db: WorkoutDatabase, id: number): Promise<Session> {
  validId(id);
  const row = await db.getFirstAsync<SessionSummary>('SELECT * FROM workout_sessions WHERE id = ?', id);
  if (!row) throw new Error('This workout could not be found.');
  const exercises: SessionExercise[] = [];
  for (const item of await db.getAllAsync<{ id: number }>('SELECT id FROM session_exercises WHERE session_id = ? ORDER BY position', id)) {
    exercises.push(await loadSessionExercise(db, item.id));
  }
  return { ...row, exercises };
}

export async function saveSetDraft(db: WorkoutDatabase, id: number, rows: DraftSet[], revision: number): Promise<number> {
  validId(id);
  const payload = JSON.stringify(parseDraft(rows));
  const result = await db.runAsync('UPDATE session_exercises SET draft_json = ?, revision = revision + 1 WHERE id = ? AND revision = ?', payload, id, revision);
  if (result.changes !== 1) throw new Error('These sets changed elsewhere. Reopen the exercise before editing.');
  return revision + 1;
}

function actualValues(rows: DraftSet[], loading: Loading, skipEmptyRows: boolean) {
  return parseDraft(rows).flatMap((row, index) => {
    if (skipEmptyRows && !row.weight.trim() && !row.reps.trim()) return [];
    if (!/^\d+$/.test(row.reps.trim()) || Number(row.reps) < 1 || Number(row.reps) > 1000) throw new Error(`Set ${index + 1}: enter whole reps from 1 to 1,000.`);
    let weight: number | null = null;
    if (loading === 'bodyweight') {
      if (row.weight.trim()) throw new Error(`Set ${index + 1}: leave weight blank for a bodyweight exercise.`);
    } else {
      const match = /^(\d*)(?:\.(\d{1,3}))?$/.exec(row.weight.trim());
      if (!match || (!match[1] && !match[2])) throw new Error(`Set ${index + 1}: enter a nonnegative weight with up to three decimal places.`);
      weight = Number(match[1] || 0) * 1000 + Number((match[2] ?? '').padEnd(3, '0'));
      if (!Number.isSafeInteger(weight) || weight > 100000000) throw new Error(`Set ${index + 1}: weight must be at most 100,000 ${row.unit}.`);
    }
    return [{ row, weight, reps: Number(row.reps), position: index }];
  });
}

async function currentExercise(tx: Executor, id: number, revision: number): Promise<ExerciseRow> {
  const row = await tx.getFirstAsync<ExerciseRow>('SELECT * FROM session_exercises WHERE id = ?', id);
  if (!row || row.revision !== revision) throw new Error('These sets changed elsewhere. Reopen the exercise before editing.');
  return row;
}

export async function saveActualSets(db: WorkoutDatabase, id: number, revision: number, skipEmptyRows = false): Promise<void> {
  await db.withExclusiveTransactionAsync(async (tx) => {
    const exercise = await currentExercise(tx, id, revision);
    if (exercise.draft_json === null) return;
    const values = actualValues(parseDraft(JSON.parse(exercise.draft_json)), exercise.loading, skipEmptyRows);
    const keys = new Set(values.map((item) => item.row.key));
    for (const old of await tx.getAllAsync<{ id: number; client_key: string }>('SELECT id, client_key FROM actual_sets WHERE session_exercise_id = ?', id)) {
      if (!keys.has(old.client_key)) await tx.runAsync('DELETE FROM actual_sets WHERE id = ?', old.id);
    }
    for (const { row, weight, reps, position } of values) {
      await tx.runAsync(`
        INSERT INTO actual_sets (session_exercise_id, client_key, position, weight_milli, reps, unit) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_exercise_id, client_key) DO UPDATE SET position = excluded.position,
          weight_milli = excluded.weight_milli, reps = excluded.reps, unit = excluded.unit
      `, id, row.key, position, weight, reps, row.unit);
    }
    await tx.runAsync('UPDATE session_exercises SET draft_json = NULL, revision = revision + 1 WHERE id = ?', id);
  });
}

export async function discardSetDraft(db: WorkoutDatabase, id: number, revision: number): Promise<void> {
  const result = await db.runAsync('UPDATE session_exercises SET draft_json = NULL, revision = revision + 1 WHERE id = ? AND revision = ?', id, revision);
  if (result.changes !== 1) throw new Error('These sets changed elsewhere. Reopen the exercise before editing.');
}

export async function addSessionExercise(db: WorkoutDatabase, sessionId: number, exerciseId: number): Promise<void> {
  validId(sessionId);
  validId(exerciseId);
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (!await tx.getFirstAsync('SELECT id FROM workout_sessions WHERE id = ?', sessionId)) throw new Error('This workout could not be found.');
    const exercise = await tx.getFirstAsync<{ name: string; loading: Loading; muscle_group: string }>('SELECT name, loading, muscle_group FROM exercises WHERE id = ? AND archived = 0', exerciseId);
    if (!exercise) throw new Error('Select an available exercise.');
    const preference = await tx.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'weight_unit'");
    if (preference?.value !== 'lb' && preference?.value !== 'kg') throw new Error('Could not read the weight preference.');
    await tx.runAsync(`
      INSERT INTO session_exercises (session_id, exercise_id, name, loading, muscle_group, position, planned_unit)
      SELECT ?, ?, ?, ?, ?, COALESCE(MAX(position) + 1, 0), ? FROM session_exercises WHERE session_id = ?
    `, sessionId, exerciseId, exercise.name, exercise.loading, exercise.muscle_group, preference.value, sessionId);
  });
}

export class IncompleteWorkoutError extends Error {
  missing: string[];
  constructor(missing: string[]) {
    super('Some planned sets have not been recorded.');
    this.missing = missing;
  }
}

export async function finishWorkout(db: WorkoutDatabase, sessionId: number, allowPartial = false, now = new Date()): Promise<void> {
  validId(sessionId);
  await db.withExclusiveTransactionAsync(async (tx) => {
    const session = await tx.getFirstAsync<SessionSummary>('SELECT * FROM workout_sessions WHERE id = ?', sessionId);
    if (!session) throw new Error('This workout could not be found.');
    if (session.status === 'completed') return;
    const exercises = await tx.getAllAsync<{ name: string; planned_sets: number | null; draft_json: string | null; count: number }>(`
      SELECT e.name, e.planned_sets, e.draft_json, COUNT(a.id) AS count FROM session_exercises e
      LEFT JOIN actual_sets a ON a.session_exercise_id = e.id WHERE e.session_id = ? GROUP BY e.id ORDER BY e.position
    `, sessionId);
    if (exercises.some((e) => e.draft_json !== null)) throw new Error('Save or discard pending set drafts before finishing.');
    const missing = exercises.filter((e) => e.count < (e.planned_sets ?? 1)).map((e) => `${e.name}: ${e.count} of ${e.planned_sets ?? 1} sets recorded`);
    if (missing.length && !allowPartial) throw new IncompleteWorkoutError(missing);
    await tx.runAsync("UPDATE workout_sessions SET status = 'completed', finished_at = ? WHERE id = ?", now.toISOString(), sessionId);
  });
}

export function formatActualSet(set: ActualSet, loading: Loading): string {
  return loading === 'bodyweight' ? `${set.reps} reps · bodyweight` : `${set.weight_milli! / 1000} ${set.unit}${loading === 'per_hand' ? ' per hand' : ''} × ${set.reps} reps`;
}
