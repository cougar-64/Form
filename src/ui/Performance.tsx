import { Body } from './Screen';
import { displayDate } from '../data/dates';
import { formatActualSet, type ActualSet, type PreviousPerformance } from '../data/sessions';
import type { Loading } from '../data/workouts';

export function ActualSets({ sets, loading }: { sets: ActualSet[]; loading: Loading }) {
  return sets.length ? <>{sets.map((set) => <Body key={set.id}>Set {set.position + 1}: {formatActualSet(set, loading)}</Body>)}</> : <Body>No actual sets saved.</Body>;
}

export function PreviousSets({ previous, loading }: { previous: PreviousPerformance | null; loading: Loading }) {
  return <>
    <Body>{previous ? `Previous performance · ${displayDate(previous.date)}` : 'No previous saved performance.'}</Body>
    {previous && <ActualSets sets={previous.sets} loading={loading} />}
  </>;
}
