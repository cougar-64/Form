import { Body, Card, Screen } from '../../ui/Screen';
import { WeightPreference } from '../../ui/WeightPreference';

export default function Home() {
  return (
    <Screen title="Your training, recorded." subtitle="Plan your week. Record what you do. See your progress.">
      <Card title="Your workout starts here">
        <Body>No workout planned yet. Your planned exercises and saved sets will appear here once workout logging is available.</Body>
      </Card>
      <WeightPreference />
    </Screen>
  );
}
