import { Body, Card, Screen } from '../../ui/Screen';

export default function Calendar() {
  return (
    <Screen title="Your week" subtitle="A plan that fits the way you train.">
      <Card title="Build your weekly schedule">
        <Body>Weekly planning is coming next. Each weekday will have its own workout, even when days share a name. Sunday will start as your rest day.</Body>
      </Card>
    </Screen>
  );
}
