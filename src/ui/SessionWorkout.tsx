import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { addSessionExercise, finishWorkout, IncompleteWorkoutError, type Session } from '../data/sessions';
import { createExercise, listExercises, LOADING, type Exercise, type Loading } from '../data/workouts';
import { Action, Choices, Field, Message } from './Fields';
import { Body, Card } from './Screen';
import { ExerciseSetTable } from './ExerciseSetTable';
import type { SetEntryState } from './useSetEntries';
import { waitForSetEntryWrites } from './setEntryQueue';
import { usePendingSetGuard } from './usePendingSetGuard';

export function SessionWorkout({ session, onChanged }: { session: Session; onChanged: () => void }) {
  const db = useSQLiteContext();
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState('');
  const [loading, setLoading] = useState<Loading>('total');
  const [entries, setEntries] = useState<Record<number, SetEntryState>>({});
  const onEntryState = useCallback((id: number, value: SetEntryState) => {
    setEntries((previous) => {
      const old = previous[id];
      if (old && old.pending === value.pending && old.saving === value.saving && old.failed === value.failed && old.changed === value.changed) return previous;
      return { ...previous, [id]: value };
    });
  }, []);
  const states = Object.values(entries);
  const savingSets = states.some((state) => state.saving);
  const pendingSets = states.some((state) => state.pending);
  const failedSets = states.some((state) => state.failed);
  const controlsBlocked = busy || savingSets || pendingSets || failedSets;
  usePendingSetGuard({ saving: busy || savingSets, pending: pendingSets, failed: failedSets });

  async function run(task: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError('');
    try { await waitForSetEntryWrites(); await task(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this change. Please try again.'); }
    finally { operation.current = false; setBusy(false); }
  }

  async function finish(partial = false) {
    if (states.some((state) => state.changed)) { setError('Save or reset the changed sets before finishing.'); return; }
    await run(async () => {
      try { await finishWorkout(db, session.id, partial); onChanged(); }
      catch (cause) {
        if (!(cause instanceof IncompleteWorkoutError)) throw cause;
        Alert.alert('Finish a partial workout?', `${cause.missing.join('\n')}\n\nMark this workout completed anyway?`, [
          { text: 'Keep training', style: 'cancel' },
          { text: 'Finish workout', onPress: () => { void finish(true); } },
        ]);
      }
    });
  }

  function add(id: number) {
    void run(async () => {
      await addSessionExercise(db, session.id, id);
      setOpen(false); setSearch(''); onChanged();
    });
  }

  return <>
    <Card title={session.name}>
      <Body>{session.status === 'in_progress' ? 'Workout in progress' : 'Workout completed'}</Body>
    </Card>
    {session.warmup ? <Card title="Warmup instructions"><Body>{session.warmup}</Body></Card> : null}
    {session.exercises.map((exercise) => <ExerciseSetTable key={exercise.id} exercise={exercise} disabled={busy || savingSets} onStateChange={onEntryState} />)}
    <Action title={open ? 'Close exercise library' : 'Add an exercise'} secondary disabled={controlsBlocked} onPress={() => {
      if (open) { setOpen(false); return; }
      void run(async () => { setLibrary(await listExercises(db)); setOpen(true); });
    }} />
    {open && <>
      <Card title="Add to this session">
        <Body>Your weekly template will not change.</Body>
        <Field label="Search exercises" value={search} onChangeText={setSearch} editable={!busy} />
        {library.filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase())).map((e) => <Action key={e.id} title={`Add ${e.name}`} secondary disabled={busy} onPress={() => add(e.id)} />)}
      </Card>
      <Card title="Create a custom exercise">
        <Field label="Exercise name" value={name} onChangeText={setName} maxLength={120} editable={!busy} />
        <Field label="Muscle group (optional)" value={muscle} onChangeText={setMuscle} maxLength={80} editable={!busy} />
        <Choices label="How weight is measured" value={loading} onChange={setLoading} disabled={busy} options={(Object.entries(LOADING) as [Loading, string][]).map(([value, label]) => ({ value, label }))} />
        <Action title="Create and add exercise" disabled={busy} onPress={() => {
          void run(async () => {
            const exercise = await createExercise(db, name, loading, muscle);
            // Keep a created library entry available even if adding to the session fails.
            setLibrary((entries) => [...entries, exercise]); setName(''); setMuscle('');
            await addSessionExercise(db, session.id, exercise.id);
            setOpen(false); onChanged();
          });
        }} />
      </Card>
    </>}
    {error ? <Message text={error} /> : null}
    {session.status === 'in_progress' && <Action title={busy ? 'Saving…' : 'Finish workout'} disabled={controlsBlocked} onPress={() => { void finish(); }} />}
  </>;
}
