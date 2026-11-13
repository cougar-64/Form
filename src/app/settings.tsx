import { Screen } from '../ui/Screen';
import { WeightPreference } from '../ui/WeightPreference';

export default function Settings() {
  return (
    <Screen title="Settings" subtitle="Your preferences.">
      <WeightPreference />
    </Screen>
  );
}
