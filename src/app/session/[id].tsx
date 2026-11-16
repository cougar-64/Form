import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { loadSession, type Session } from '../../data/sessions';
import { displayDate } from '../../data/dates';
import { Action, Message } from '../../ui/Fields';
import { Body, Screen } from '../../ui/Screen';
import { SessionWorkout } from '../../ui/SessionWorkout';
import { waitForSetEntryWrites } from '../../ui/setEntryQueue';

export default function RecordedWorkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setError('');
    waitForSetEntryWrites().then(() => loadSession(db, Number(id))).then((value) => { if (active) setSession(value); }, (cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load workout.'); });
    return () => { active = false; };
  }, [db, id, attempt]));
  return <Screen title="Recorded workout" subtitle={session ? `Started ${displayDate(session.performed_date)}` : 'Opening workout…'}>
    {error ? <><Message text={error} /><Action title="Try again" onPress={() => setAttempt((n) => n + 1)} /></> : null}
    {!session && !error && <Body>Loading…</Body>}
    {session && <SessionWorkout key={session.id} session={session} onChanged={() => setAttempt((n) => n + 1)} />}
  </Screen>;
}
