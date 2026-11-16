import { Body, Screen } from '../../ui/Screen';
import { useFocusEffect } from 'expo-router';
import { Action } from '../../ui/Fields';
import { useCallback, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getDatedPlan, type DatedPlan } from '../../data/schedule';
import { displayDate } from '../../data/dates';
import { useLocalToday } from '../../ui/useLocalToday';
import { DatedWorkout } from '../../ui/DatedWorkout';
import { Message } from '../../ui/Fields';
import { getHomeSession, loadSession, previousPerformance, startWorkout, type Session, type PreviousPerformance } from '../../data/sessions';
import { SessionWorkout } from '../../ui/SessionWorkout';
import { waitForSetEntryWrites } from '../../ui/setEntryQueue';

export default function Home() {
  const db = useSQLiteContext();
  const today = useLocalToday();
  const [plan, setPlan] = useState<DatedPlan | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [previous, setPrevious] = useState<Record<number, PreviousPerformance | null>>({});
  const [busy, setBusy] = useState(false);
  const starting = useRef(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setError(false);
    (async () => {
      await waitForSetEntryWrites();
      const existing = await getHomeSession(db, today);
      if (existing) {
        const value = await loadSession(db, existing.id);
        if (active) { setSession(value); setPlan(null); }
      } else {
        const value = await getDatedPlan(db, today, today);
        const history: Record<number, PreviousPerformance | null> = {};
        for (const item of value.exercises) history[item.exercise_id] = await previousPerformance(db, item.exercise_id, today);
        if (active) { setPrevious(history); setPlan(value); setSession(null); }
      }
    })().catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [db, today, retry]));
  return (
    <Screen title={session ? session.performed_date === today ? 'Today’s workout' : 'Workout in progress' : 'Today’s plan'} subtitle={session ? `Started ${displayDate(session.performed_date)}` : displayDate(today)} centered>
      {error && <><Message text="Could not load today’s plan." /><Action title="Try again" onPress={() => setRetry((v) => v + 1)} /></>}
      {!plan && !session && !error && <Body>Loading workout…</Body>}
      {plan?.name && !plan.rest && !plan.beforeStart && <Action title={busy ? 'Starting…' : 'Start workout'} disabled={busy} onPress={() => {
        if (starting.current) return;
        starting.current = true; setBusy(true); setError(false);
        void startWorkout(db).then((id) => loadSession(db, id)).then((value) => { setSession(value); setPlan(null); })
          .catch(() => setError(true)).finally(() => { starting.current = false; setBusy(false); });
      }} />}
      {plan && <DatedWorkout plan={plan} previous={previous} />}
      {session && <SessionWorkout key={session.id} session={session} onChanged={() => setRetry((v) => v + 1)} />}
    </Screen>
  );
}
