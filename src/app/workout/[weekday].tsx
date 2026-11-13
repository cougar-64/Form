import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, View } from 'react-native';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { readWeightUnit } from '../../data/settings';
import { createExercise, DAYS, listExercises, loadWorkout, LOADING, saveWorkout, type Exercise, type Loading, type PlannedExercise, type Unit, type WorkoutDraft } from '../../data/workouts';
import { Action, Choices, Field, Message } from '../../ui/Fields';
import { Body, Card, Screen } from '../../ui/Screen';

export default function WorkoutBuilder() {
  const { weekday } = useLocalSearchParams<{ weekday: string }>();
  const day = Number(weekday);
  const db = useSQLiteContext();
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [unit, setUnit] = useState<Unit>('lb');
  const [error, setError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [muscle, setMuscle] = useState('');
  const [loading, setLoading] = useState<Loading>('total');
  const nextKey = useRef(0);

  useEffect(() => {
    let active = true;
    setError('');
    Promise.all([loadWorkout(db, day), readWeightUnit(db), listExercises(db)]).then(([value, preference, exercises]) => {
      if (active) { setDraft(value); setUnit(preference); setLibrary(exercises); setDirty(false); }
    }, () => { if (active) setError('Could not open this workout. Go back or try again.'); });
    return () => { active = false; };
  }, [db, day, loadAttempt]);

  usePreventRemove(dirty || busy || Boolean(newName.trim() || muscle.trim()), ({ repeat }) => {
    if (saving.current) {
      Alert.alert('Save in progress', 'Please wait for the save to finish before leaving.');
      return;
    }
    Alert.alert('Discard workout changes?', 'Your unsaved workout edits will be lost. Exercises already created remain in the library.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => {
        setDirty(false);
        setNewName('');
        setMuscle('');
        repeat();
      } },
    ]);
  });

  function update(change: Partial<WorkoutDraft>) {
    setDraft((previous) => previous ? { ...previous, ...change } : previous);
    setDirty(true);
    setError('');
  }

  function add(exercise: Exercise) {
    if (!draft) return;
    update({ exercises: [...draft.exercises, {
      ...exercise, key: `new-${++nextKey.current}`, sets: '', reps: '', weight: '', unit,
    }] });
    setLibraryOpen(false);
    setSearch('');
    Keyboard.dismiss();
  }

  function edit(key: string, change: Partial<PlannedExercise>) {
    if (draft) update({ exercises: draft.exercises.map((exercise) => exercise.key === key ? { ...exercise, ...change } : exercise) });
  }

  function move(index: number, offset: number) {
    if (!draft) return;
    const items = [...draft.exercises];
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target]!, items[index]!];
    update({ exercises: items });
  }

  async function create() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const exercise = await createExercise(db, newName, loading, muscle);
      setLibrary((rows) => [...rows, exercise].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setMuscle('');
      add(exercise);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create the exercise.'); }
    finally { saving.current = false; setBusy(false); }
  }

  async function save() {
    if (!draft || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    Keyboard.dismiss();
    try {
      const versionId = await saveWorkout(db, draft);
      setDraft({ ...draft, versionId });
      setDirty(false);
      Alert.alert('Workout saved', `${DAYS[day - 1]} is saved from today onward. Earlier dated plans and other weekdays have not changed.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your workout. Please try again.'); }
    finally { saving.current = false; setBusy(false); }
  }

  if (!draft) return (
    <Screen title="Workout builder" subtitle="Opening your weekday plan…">
      {error ? <><Message text={error} /><Action title="Try again" onPress={() => setLoadAttempt((n) => n + 1)} /></> : <Body>Loading…</Body>}
    </Screen>
  );

  const editable = !busy;
  return (
    <Screen title={DAYS[day - 1]!} subtitle="Edit this weekday’s template from today onward. Planned weights never count as recorded lifts or personal records.">
      <Card title="Workout details">
        <Choices label="Day type" value={draft.rest ? 'rest' : 'workout'} disabled={busy}
          options={[{ value: 'workout', label: 'Workout' }, { value: 'rest', label: 'Rest day' }]}
          onChange={(value) => {
            if (value === 'rest' && draft.exercises.length) {
              Alert.alert('Make this a rest day?', 'This removes exercises from the current draft. Previously saved versions remain unchanged.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Make rest day', style: 'destructive', onPress: () => update({ rest: true, exercises: [], name: 'Rest' }) },
              ]);
            } else update({ rest: value === 'rest', name: value === 'rest' ? 'Rest' : draft.name === 'Rest' ? '' : draft.name });
          }} />
        <Field label="Workout name" value={draft.name} onChangeText={(name) => update({ name })} placeholder="For example, Push A" maxLength={120} editable={editable} />
        {!draft.rest && <Field label="Warmup instructions (optional)" value={draft.warmup} onChangeText={(warmup) => update({ warmup })}
          placeholder="For example: Lat pulldown — warm up at 20, 30, and 50 lb" multiline maxLength={4000} editable={editable} />}
      </Card>
      {!draft.rest && <>
        {draft.exercises.map((exercise, index) => (
          <Card key={exercise.key} title={`${index + 1}. ${exercise.name}`}>
            <Body>{LOADING[exercise.loading]}{exercise.muscle_group ? ` · ${exercise.muscle_group}` : ''}</Body>
            <Field label={`${exercise.name}: planned sets`} value={exercise.sets} onChangeText={(sets) => edit(exercise.key, { sets })} placeholder="For example, 3" keyboardType="number-pad" editable={editable} />
            <Field label={`${exercise.name}: reps per set`} value={exercise.reps} onChangeText={(reps) => edit(exercise.key, { reps })} placeholder="8 or 8-12" keyboardType="numbers-and-punctuation" editable={editable} />
            {exercise.loading !== 'bodyweight' && <>
              <Field label={`${exercise.name}: planned weight (optional)`} value={exercise.weight} onChangeText={(weight) => edit(exercise.key, { weight })} placeholder="Leave blank if undecided" keyboardType="decimal-pad" editable={editable} />
              <Choices label={`${exercise.name}: weight unit`} value={exercise.unit} onChange={(value) => edit(exercise.key, { unit: value })} disabled={busy}
                options={[{ value: 'lb', label: 'Pounds (lb)' }, { value: 'kg', label: 'Kilograms (kg)' }]} />
            </>}
            <View style={{ gap: 8 }}>
              <Action title={`Move ${exercise.name} up`} secondary disabled={busy || index === 0} onPress={() => move(index, -1)} />
              <Action title={`Move ${exercise.name} down`} secondary disabled={busy || index === draft.exercises.length - 1} onPress={() => move(index, 1)} />
              <Action title={`Remove ${exercise.name}`} secondary disabled={busy} onPress={() => update({ exercises: draft.exercises.filter((item) => item.key !== exercise.key) })} />
            </View>
          </Card>
        ))}
        {!draft.exercises.length && <Body>No exercises yet. Add one from the library or create your own.</Body>}
        <Action title={libraryOpen ? 'Close exercise library' : 'Add an exercise'} secondary disabled={busy} onPress={() => setLibraryOpen(!libraryOpen)} />
        {libraryOpen && <>
          <Card title="Exercise library">
            <Field label="Search exercises" value={search} onChangeText={setSearch} placeholder="Search by name" editable={editable} />
            {library.filter((exercise) => exercise.name.toLowerCase().includes(search.trim().toLowerCase())).map((exercise) => (
              <Action key={exercise.id} title={`Add ${exercise.name}`} secondary disabled={busy} onPress={() => add(exercise)} />
            ))}
            {!library.some((exercise) => exercise.name.toLowerCase().includes(search.trim().toLowerCase())) && <Body>No matching exercise. Create a distinct exercise below.</Body>}
          </Card>
          <Card title="Create a custom exercise">
            <Body>Creating saves it to your library and adds it to this draft. Use separate names for different variations or machines.</Body>
            <Field label="Exercise name" value={newName} onChangeText={setNewName} placeholder="For example, Incline barbell bench press" maxLength={120} editable={editable} />
            <Field label="Muscle group (optional)" value={muscle} onChangeText={setMuscle} placeholder="For example, Chest" maxLength={80} editable={editable} />
            <Choices label="How weight is measured" value={loading} onChange={setLoading} disabled={busy}
              options={(Object.entries(LOADING) as [Loading, string][]).map(([value, label]) => ({ value, label }))} />
            <Body>For Smith machines, use a consistent bar/load convention. Form does not estimate the bar’s resistance.</Body>
            <Action title="Create and add exercise" disabled={busy} onPress={() => { void create(); }} />
          </Card>
        </>}
      </>}
      {error ? <Message text={error} /> : null}
      <Body>{dirty ? 'Unsaved changes. Save before leaving; closing the app can lose this workout draft.' : 'No unsaved workout changes.'}</Body>
      <Action title={busy ? 'Saving…' : `Save ${DAYS[day - 1]}`} disabled={busy || !dirty} onPress={() => { void save(); }} />
      <Action title="Back to templates" secondary disabled={busy} onPress={() => router.back()} />
    </Screen>
  );
}
