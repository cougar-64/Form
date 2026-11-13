import { Body, Screen } from '../../ui/Screen';
import { useFocusEffect } from 'expo-router';
import { Action } from '../../ui/Fields';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getDatedPlan, type DatedPlan } from '../../data/schedule';
import { displayDate } from '../../data/dates';
import { useLocalToday } from '../../ui/useLocalToday';
import { DatedWorkout } from '../../ui/DatedWorkout';
import { Message } from '../../ui/Fields';

export default function Home() {
  const db = useSQLiteContext();
  const today = useLocalToday();
  const [plan, setPlan] = useState<DatedPlan | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setError(false);
    setPlan(null);
    getDatedPlan(db, today, today).then((value) => { if (active) setPlan(value); }, () => { if (active) setError(true); });
    return () => { active = false; };
  }, [db, today, retry]));
  return (
    <Screen title="Today’s plan" subtitle={displayDate(today)} centered>
      {error && <><Message text="Could not load today’s plan." /><Action title="Try again" onPress={() => setRetry((v) => v + 1)} /></>}
      {!plan && !error && <Body>Loading today’s plan…</Body>}
      {plan && <DatedWorkout plan={plan} />}
    </Screen>
  );
}
