import type { SQLiteDatabase } from 'expo-sqlite';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const LOADING = {
  total: 'Total weight (including bar)',
  per_hand: 'Dumbbells: weight per hand',
  machine: 'Machine: displayed setting',
  bodyweight: 'Bodyweight',
} as const;
export type Loading = keyof typeof LOADING;
export type Unit = 'lb' | 'kg';
export type WorkoutDatabase = Pick<SQLiteDatabase, 'getFirstAsync' | 'getAllAsync' | 'runAsync' | 'withExclusiveTransactionAsync'>;
export type Exercise = { id: number; name: string; loading: Loading; muscle_group: string };
export type PlannedExercise = Exercise & {
  key: string; sets: string; reps: string; weight: string; unit: Unit;
};
export type WorkoutDraft = {
  weekday: number; versionId: number | null; name: string; warmup: string; rest: boolean; exercises: PlannedExercise[];
};
export type DaySummary = { weekday: number; name: string | null; is_rest: number | null; exercise_count: number };

export async function listDays(db: WorkoutDatabase): Promise<DaySummary[]> {
  return db.getAllAsync<DaySummary>(`
    SELECT d.weekday, v.name, v.is_rest, COUNT(p.id) AS exercise_count
    FROM routine_days d LEFT JOIN routine_versions v ON v.id = d.current_version_id
    LEFT JOIN planned_exercises p ON p.version_id = v.id
    GROUP BY d.weekday ORDER BY d.weekday
  `);
}

export async function listExercises(db: WorkoutDatabase, search = ''): Promise<Exercise[]> {
  return db.getAllAsync<Exercise>(
    'SELECT id, name, loading, muscle_group FROM exercises WHERE archived = 0 AND instr(lower(name), lower(?)) > 0 ORDER BY name COLLATE NOCASE',
    search.trim(),
  );
}

export async function createExercise(db: WorkoutDatabase, name: string, loading: Loading, muscle: string): Promise<Exercise> {
  name = name.trim();
  muscle = muscle.trim();
  if (!name || name.length > 120) throw new Error('Use an exercise name between 1 and 120 characters.');
  if (!Object.hasOwn(LOADING, loading)) throw new Error('Choose how this exercise measures weight.');
  if (muscle.length > 80) throw new Error('Keep the muscle group under 81 characters.');
  if (await db.getFirstAsync('SELECT id FROM exercises WHERE name = ? COLLATE NOCASE', name)) {
    throw new Error('That exercise name already exists. Select it from the library or use a distinct variation name.');
  }
  try {
    const result = await db.runAsync('INSERT INTO exercises (name, loading, muscle_group) VALUES (?, ?, ?)', name, loading, muscle);
    return { id: result.lastInsertRowId, name, loading, muscle_group: muscle };
  } catch {
    throw new Error('Could not create the exercise. Try again or choose a different name.');
  }
}

export async function loadWorkout(db: WorkoutDatabase, weekday: number): Promise<WorkoutDraft> {
  assertDay(weekday);
  const row = await db.getFirstAsync<{ id: number; name: string; warmup: string; is_rest: number }>(`
    SELECT v.* FROM routine_days d JOIN routine_versions v ON v.id = d.current_version_id WHERE d.weekday = ?
  `, weekday);
  const exercises = row ? await db.getAllAsync<Exercise & {
    planned_id: number; sets: number; reps_min: number; reps_max: number; weight: number | null; weight_unit: Unit;
  }>(`
    SELECT e.id, e.name, e.loading, e.muscle_group, p.id AS planned_id, p.sets, p.reps_min, p.reps_max, p.weight, p.weight_unit
    FROM planned_exercises p JOIN exercises e ON e.id = p.exercise_id WHERE p.version_id = ? ORDER BY p.position
  `, row.id) : [];
  return {
    weekday, versionId: row?.id ?? null, name: row?.name ?? '', warmup: row?.warmup ?? '', rest: row?.is_rest === 1,
    exercises: exercises.map((e) => ({
      ...e, key: String(e.planned_id), sets: String(e.sets),
      reps: e.reps_min === e.reps_max ? String(e.reps_min) : `${e.reps_min}-${e.reps_max}`,
      weight: e.weight === null ? '' : String(e.weight), unit: e.weight_unit,
    })),
  };
}

function assertDay(day: number) {
  if (!Number.isInteger(day) || day < 1 || day > 7) throw new Error('Choose a weekday from Monday through Sunday.');
}

export function validateWorkout(draft: WorkoutDraft) {
  assertDay(draft.weekday);
  if (!draft.name.trim() || draft.name.trim().length > 120) throw new Error('Enter a workout name between 1 and 120 characters.');
  if (draft.warmup.length > 4000) throw new Error('Keep warmup instructions under 4,001 characters.');
  if (!draft.rest && draft.exercises.length === 0) throw new Error('Add at least one exercise, or mark this as a rest day.');
  if (draft.rest && draft.exercises.length) throw new Error('Remove planned exercises before saving a rest day.');
  return draft.exercises.map((exercise) => {
    const prefix = `${exercise.name}: `;
    if (!/^\d+$/.test(exercise.sets) || Number(exercise.sets) < 1 || Number(exercise.sets) > 100) {
      throw new Error(prefix + 'enter a whole number of sets from 1 to 100.');
    }
    const reps = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(exercise.reps.trim());
    const min = Number(reps?.[1]);
    const max = Number(reps?.[2] ?? reps?.[1]);
    if (!reps || min < 1 || max < min || max > 1000) throw new Error(prefix + 'enter reps such as 8 or 8-12, from 1 to 1,000.');
    const weight = exercise.weight.trim();
    if (exercise.unit !== 'lb' && exercise.unit !== 'kg') throw new Error(prefix + 'choose pounds or kilograms.');
    if (weight && (!/^(?:\d+(?:\.\d{1,3})?|\.\d{1,3})$/.test(weight) || Number(weight) > 100000)) {
      throw new Error(prefix + 'enter a nonnegative weight with up to three decimal places, or leave it blank.');
    }
    if (exercise.loading === 'bodyweight' && weight) throw new Error(prefix + 'bodyweight exercises do not need a planned load.');
    return { exercise, sets: Number(exercise.sets), min, max, weight: weight ? Number(weight) : null };
  });
}

export async function saveWorkout(db: WorkoutDatabase, draft: WorkoutDraft): Promise<number> {
  const planned = validateWorkout(draft);
  let versionId = 0;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const current = await tx.getFirstAsync<{ current_version_id: number | null }>('SELECT current_version_id FROM routine_days WHERE weekday = ?', draft.weekday);
    if (!current || current.current_version_id !== draft.versionId) throw new Error('This workout changed elsewhere. Go back and reopen it before saving.');
    const result = await tx.runAsync(
      'INSERT INTO routine_versions (weekday, name, warmup, is_rest) VALUES (?, ?, ?, ?)',
      draft.weekday, draft.name.trim(), draft.warmup.trim(), draft.rest ? 1 : 0,
    );
    versionId = result.lastInsertRowId;
    for (const [position, item] of planned.entries()) {
      const existing = await tx.getFirstAsync<{ loading: Loading }>('SELECT loading FROM exercises WHERE id = ? AND archived = 0', item.exercise.id);
      if (!existing || existing.loading !== item.exercise.loading) throw new Error('An exercise is no longer available. Reopen the workout and select it again.');
      await tx.runAsync(`
        INSERT INTO planned_exercises (version_id, exercise_id, position, sets, reps_min, reps_max, weight, weight_unit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, versionId, item.exercise.id, position, item.sets, item.min, item.max, item.weight, item.exercise.unit);
    }
    await tx.runAsync('UPDATE routine_days SET current_version_id = ? WHERE weekday = ?', versionId, draft.weekday);
  });
  return versionId;
}
