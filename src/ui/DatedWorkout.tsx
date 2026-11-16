import { Body, Card } from './Screen';
import { LOADING } from '../data/workouts';
import type { DatedPlan } from '../data/schedule';
import type { PreviousPerformance } from '../data/sessions';
import { PreviousSets } from './Performance';

export function DatedWorkout({ plan, previous }: { plan: DatedPlan; previous?: Record<number, PreviousPerformance | null> }) {
  if (plan.beforeStart) return <Card title="Before schedule began"><Body>No workout is scheduled for this date.</Body></Card>;
  if (plan.name === null) return <Card title="No workout planned"><Body>No workout has been planned for this date.</Body></Card>;
  if (plan.rest) return <Card title={plan.name}><Body>Planned rest day.</Body></Card>;
  const muscles = [...new Set(plan.exercises.map((e) => e.muscle_group).filter(Boolean))];
  return <>
    <Card title={plan.name}><Body>Planned workout{muscles.length ? ` · ${muscles.join(', ')}` : ''}</Body></Card>
    {plan.warmup ? <Card title="Warmup instructions"><Body>{plan.warmup}</Body></Card> : null}
    {plan.exercises.map((exercise, index) => (
      <Card key={`${exercise.exercise_id}-${index}`} title={`${index + 1}. ${exercise.name}`}>
        <Body>Planned: {exercise.sets} sets × {exercise.reps_min === exercise.reps_max ? exercise.reps_min : `${exercise.reps_min}–${exercise.reps_max}`} reps</Body>
        <Body>{exercise.loading === 'bodyweight' ? 'Bodyweight' : exercise.weight === null ? 'Planned weight: not specified' : `Planned weight: ${exercise.weight} ${exercise.weight_unit}${exercise.loading === 'per_hand' ? ' per hand' : ''}`}</Body>
        {exercise.loading !== 'bodyweight' && <Body>{LOADING[exercise.loading]}</Body>}
        {previous && <PreviousSets previous={previous[exercise.exercise_id] ?? null} loading={exercise.loading} />}
      </Card>
    ))}
  </>;
}
