import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { DAYS, listDays, type DaySummary } from '../data/workouts';
import { Body, Card, Screen } from '../ui/Screen';
import { Action, Message } from '../ui/Fields';

export default function Templates() {
  const db = useSQLiteContext();
  const [days, setDays] = useState<DaySummary[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setError(false);
    listDays(db).then((rows) => { if (active) setDays(rows); }, () => { if (active) setError(true); });
    return () => { active = false; };
  }, [db, retry]));
  return (
    <Screen title="Weekly templates" subtitle="Each weekday is independent. Saved changes apply from today onward; earlier dated plans stay unchanged.">
      {error && <><Message text="Could not load your templates." /><Action title="Try again" onPress={() => setRetry((v) => v + 1)} /></>}
      {!days.length && !error && <Body>Loading your templates…</Body>}
      {days.map((day) => (
        <Card key={day.weekday} title={DAYS[day.weekday - 1]!}>
          <Body>{day.name === null ? 'Not planned yet' : `${day.name}${day.is_rest ? ' · Rest day' : ` · ${day.exercise_count} exercises`}`}</Body>
          <Action title={`${day.name === null ? 'Plan' : 'Edit'} ${DAYS[day.weekday - 1]} template`} secondary
            onPress={() => router.push({ pathname: '/workout/[weekday]', params: { weekday: day.weekday } })} />
        </Card>
      ))}
    </Screen>
  );
}
