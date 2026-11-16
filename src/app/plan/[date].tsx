import { useCallback, useState } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getDatedPlan, type DatedPlan } from '../../data/schedule';
import { displayDate } from '../../data/dates';
import { useLocalToday } from '../../ui/useLocalToday';
import { DatedWorkout } from '../../ui/DatedWorkout';
import { Body, Screen } from '../../ui/Screen';
import { Action, Message } from '../../ui/Fields';

export default function PlannedWorkout() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const db = useSQLiteContext();
  const today = useLocalToday();
  const [plan, setPlan] = useState<DatedPlan | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setPlan(null);
    setError(false);
    getDatedPlan(db, date, today).then((value) => { if (active) setPlan(value); }, () => { if (active) setError(true); });
    return () => { active = false; };
  }, [db, date, today, retry]));
  return (
    <Screen title="Planned workout" subtitle={plan ? displayDate(plan.date) : 'Opening dated plan…'}>
      {error && <><Message text="Could not open this date’s plan." /><Action title="Try again" onPress={() => setRetry((v) => v + 1)} /></>}
      {!plan && !error && <Body>Loading…</Body>}
      {plan && <DatedWorkout plan={plan} />}
      {plan?.sessionId && <Action title={plan.sessionStatus === 'in_progress' ? 'Open workout in progress' : 'View or edit recorded workout'}
        onPress={() => router.push({ pathname: '/session/[id]', params: { id: plan.sessionId! } })} />}
      <Action title="View calendar" secondary onPress={() => router.replace('/calendar')} />
    </Screen>
  );
}
