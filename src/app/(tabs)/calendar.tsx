import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { DAYS } from '../../data/workouts';
import { getWeek, type CalendarWeek } from '../../data/schedule';
import { addDays, displayDate, weekDates } from '../../data/dates';
import { useLocalToday } from '../../ui/useLocalToday';
import { Body, Card, Screen } from '../../ui/Screen';
import { Action, Message } from '../../ui/Fields';

export default function Calendar() {
  const db = useSQLiteContext();
  const today = useLocalToday();
  const [anchor, setAnchor] = useState<string | null>(null);
  const containing = anchor ?? today;
  const dates = weekDates(containing);
  const [week, setWeek] = useState<CalendarWeek | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setError(false);
    setWeek(null);
    getWeek(db, containing, today).then((value) => { if (active) setWeek(value); }, () => { if (active) setError(true); });
    return () => { active = false; };
  }, [db, retry, containing, today]));
  return (
    <Screen title="Your week" subtitle={`${displayDate(dates[0]!)} – ${displayDate(dates[6]!)}`}>
      <Action title="Previous week" secondary disabled={dates[0]! <= '0001-01-08'} onPress={() => setAnchor(addDays(dates[0]!, -7))} />
      <Action title="This week" secondary onPress={() => { setAnchor(null); setRetry((v) => v + 1); }} />
      <Action title="Next week" secondary disabled={dates[6]! >= '9999-12-24'} onPress={() => setAnchor(addDays(dates[0]!, 7))} />
      <Action title="Edit weekly templates" onPress={() => router.push('/templates')} />
      {week && <Body>Schedule begins {displayDate(week.startDate)}. These are planned workouts; a past plan does not prove whether you trained.</Body>}
      {error && <><Message text="Could not load your week." /><Action title="Try again" onPress={() => setRetry((v) => v + 1)} /></>}
      {!week && !error && <Body>Loading your week…</Body>}
      {week?.days.map((day) => (
        <Card key={day.date} title={`${DAYS[day.weekday - 1]} · ${displayDate(day.date)}${day.date === today ? ' · Today' : ''}`}>
          <Body>{day.beforeStart ? 'Before schedule began' : day.name === null ? 'Not planned yet' : `${day.name}${day.rest ? ' · Planned rest' : ` · ${day.exercises.length} exercises`}`}</Body>
          {day.sessionStatus && <Body>{day.sessionStatus === 'completed' ? 'Workout completed' : 'Workout in progress'}</Body>}
          {!day.beforeStart && <Action title={`View plan for ${displayDate(day.date)}`} secondary
            onPress={() => router.push({ pathname: '/plan/[date]', params: { date: day.date } })} />}
        </Card>
      ))}
    </Screen>
  );
}
