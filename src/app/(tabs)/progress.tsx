import { Body, Card, Screen } from '../../ui/Screen';

export default function Progress() {
  return (
    <Screen title="My Progress" subtitle="Your history. Your recorded achievements.">
      <Card title="Body weight"><Body>Weight history will appear here once measurement logging is available.</Body></Card>
      <Card title="Records Room"><Body>Review saved exercise sets, your heaviest recorded single, and most reps at a specific weight. Record tracking is coming in a later milestone.</Body></Card>
    </Screen>
  );
}
