import { Body, Card, Screen } from '../../ui/Screen';

export default function Nutrition() {
  return (
    <Screen title="Daily nutrition" subtitle="Simple estimates for calories and protein.">
      <Card title="Food logging is on the way">
        <Body>You’ll be able to enter foods, set daily targets, and correct previous days. No food entries or targets have been created yet.</Body>
      </Card>
    </Screen>
  );
}
