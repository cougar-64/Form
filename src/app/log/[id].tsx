import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { loadSessionExercise, type SessionExercise } from '../../data/sessions';
import { displayDate } from '../../data/dates';
import { Action, Message } from '../../ui/Fields';
import { Body, Screen } from '../../ui/Screen';
import { ExerciseSetTable } from '../../ui/ExerciseSetTable';
import { waitForSetEntryWrites } from '../../ui/setEntryQueue';
import { usePendingSetGuard } from '../../ui/usePendingSetGuard';
import type { SetEntryState } from '../../ui/useSetEntries';

export default function SetEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [exercise, setExercise] = useState<SessionExercise | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SetEntryState>({ pending: false, saving: false, failed: false, changed: false });
  const onStateChange = useCallback((_id: number, value: SetEntryState) => setState(value), []);
  usePendingSetGuard(state);
  useEffect(() => {
    let live = true;
    setError('');
    waitForSetEntryWrites().then(() => loadSessionExercise(db, Number(id))).then(
      (value) => { if (live) setExercise(value); },
      (cause) => { if (live) setError(cause instanceof Error ? cause.message : 'Could not load these sets.'); },
    );
    return () => { live = false; };
  }, [db, id, attempt]);
  return <Screen title="Log sets" subtitle={exercise ? displayDate(exercise.performed_date) : 'Opening exercise…'}>
    {error ? <><Message text={error} /><Action title="Try again" onPress={() => setAttempt((n) => n + 1)} /></> : null}
    {!exercise && !error && <Body>Loading…</Body>}
    {exercise && <ExerciseSetTable key={exercise.id} exercise={exercise} onStateChange={onStateChange} />}
    <Action title="Back to workout" secondary disabled={state.pending || state.saving} onPress={() => router.back()} />
  </Screen>;
}
