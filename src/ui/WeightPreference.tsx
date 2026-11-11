import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { readWeightUnit, saveWeightUnit, type WeightUnit } from '../data/settings';
import { Body, Card, usePalette } from './Screen';

export function WeightPreference() {
  const database = useSQLiteContext();
  const palette = usePalette();
  const [unit, setUnit] = useState<WeightUnit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    readWeightUnit(database).then(
      (value) => { if (active) setUnit(value); },
      () => { if (active) setError('Could not load your weight preference. Reopen Form to try again.'); },
    );
    return () => { active = false; };
  }, [database]);

  async function select(next: WeightUnit) {
    if (busy || unit === null) return;
    setBusy(true);
    setError(null);
    try {
      await saveWeightUnit(database, next);
      setUnit(next);
    } catch {
      setError('Your change was not saved. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Weight preference">
      <Body>Stored on this iPhone. Pounds are the default.</Body>
      <View accessibilityRole="radiogroup" accessibilityLabel="Weight unit" style={styles.options}>
        {(['lb', 'kg'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={value === 'lb' ? 'Pounds' : 'Kilograms'}
            accessibilityState={{ checked: unit === value, disabled: busy || unit === null }}
            disabled={busy || unit === null}
            onPress={() => { void select(value); }}
            style={({ pressed }) => [styles.option, {
              borderColor: palette.accent,
              backgroundColor: unit === value ? palette.accent : palette.card,
              opacity: pressed || busy ? 0.65 : 1,
            }]}
          >
            <Text style={[styles.label, { color: unit === value ? palette.background : palette.text }]}>
              {value === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text accessibilityLiveRegion="polite" style={{ color: palette.secondary, fontSize: 16 }}>
        {error ?? (busy ? 'Saving…' : unit ? `Saved unit: ${unit}` : 'Loading preference…')}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  option: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderRadius: 12 },
  label: { fontSize: 17, fontWeight: '600' },
});
