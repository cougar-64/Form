import { Body, Card, Screen } from '../../ui/Screen';
import { WeightPreference } from '../../ui/WeightPreference';
import { router } from 'expo-router';
import { Action } from '../../ui/Fields';

export default function Home() {
  return (
    <Screen title="Your training, recorded." subtitle="Plan your week. Record what you do. See your progress.">
      <Card title="Your weekly workouts">
        <Body>Create or edit weekday workouts in Calendar. Saved plans are kept separate from your actual lifts.</Body>
        <Action title="Plan your week" onPress={() => router.push('/calendar')} />
      </Card>
      <WeightPreference />
    </Screen>
  );
}
