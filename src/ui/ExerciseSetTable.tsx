import { useEffect, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import type { SessionExercise } from '../data/sessions';
import { displayDate } from '../data/dates';
import { Action, Message } from './Fields';
import { Card, usePalette } from './Screen';
import { useSetEntries, type SetEntryState } from './useSetEntries';

export function ExerciseSetTable({ exercise, disabled = false, onStateChange }: {
  exercise: SessionExercise; disabled?: boolean; onStateChange?: (id: number, state: SetEntryState) => void;
}) {
  const entry = useSetEntries(exercise);
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(300);
  const blocked = disabled || entry.saving;
  useEffect(() => {
    onStateChange?.(exercise.id, { pending: entry.pending, saving: entry.saving, failed: Boolean(entry.writeError), changed: entry.changed });
  }, [exercise.id, onStateChange, entry.pending, entry.saving, entry.writeError, entry.changed]);

  function save() {
    Keyboard.dismiss();
    const kept = new Set(entry.rows.filter((row) => row.weight.trim() || row.reps.trim()).map((row) => row.key));
    const removed = entry.exercise.actual.filter((set) => !kept.has(set.client_key));
    if (removed.length) {
      Alert.alert('Remove recorded sets?', `Saving will remove ${removed.length} previously recorded set(s) from this exercise.`, [
        { text: 'Cancel', style: 'cancel' }, { text: 'Save changes', style: 'destructive', onPress: () => { void entry.save(); } },
      ]);
    } else void entry.save();
  }

  const text = { color: p.text };
  return (
    <Card title={exercise.name}>
      <Text style={[styles.caption, { color: p.secondary }]}>
        {exercise.loading === 'per_hand' ? 'Weight per hand' : exercise.loading === 'machine' ? 'Machine setting' : exercise.loading === 'bodyweight' ? 'Bodyweight' : 'Total weight'}
        {exercise.planned_reps_min !== null ? ` · ${exercise.planned_reps_min === exercise.planned_reps_max ? exercise.planned_reps_min : `${exercise.planned_reps_min}–${exercise.planned_reps_max}`} reps planned` : ''}
      </Text>
      {exercise.previous && <Text style={[styles.caption, { color: p.secondary }]}>Previous: {displayDate(exercise.previous.date)}</Text>}
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator>
          <View style={{ width: Math.max(width, 300 * fontScale), gap: 8 }}>
            <View style={styles.row}>
              <Text style={[styles.previous, styles.heading, text]}>Previous</Text>
              <Text style={[styles.set, styles.heading, text]}>Set</Text>
              <Text style={[styles.weight, styles.heading, text]}>Weight</Text>
              <Text style={[styles.reps, styles.heading, text]}>Reps</Text>
            </View>
            {entry.rows.map((row, index) => {
              const previous = exercise.previous?.sets.find((set) => set.position === index);
              return <View key={row.key} style={styles.row}>
                <View style={[styles.previous, styles.box, { borderColor: p.border }]}>
                  <Text accessibilityLabel={`Previous set ${index + 1}: ${previous ? `${previous.weight_milli === null ? 'bodyweight' : `${previous.weight_milli / 1000} ${previous.unit}`}, ${previous.reps} reps` : 'no previous entry'}`} style={[styles.value, text]}>
                    {previous ? `${previous.weight_milli === null ? 'BW' : `${previous.weight_milli / 1000} ${previous.unit}`}\n× ${previous.reps}` : '—'}
                  </Text>
                </View>
                <View style={[styles.set, styles.box, { borderColor: p.border }]}><Text style={[styles.value, text]}>{index + 1}</Text></View>
                <View style={[styles.weight, styles.box, styles.weightBox, { borderColor: p.border }]}>
                  {exercise.loading === 'bodyweight' ? <Text style={[styles.value, text]}>BW</Text> : <>
                    <TextInput accessibilityLabel={`${exercise.name}, set ${index + 1}, weight in ${row.unit}${exercise.loading === 'per_hand' ? ' per hand' : ''}`} value={row.weight}
                      keyboardType="decimal-pad" maxLength={30} editable={!blocked} selectTextOnFocus placeholder="—" placeholderTextColor={p.secondary}
                      onChangeText={(weight) => entry.edit(row.key, { weight })} style={[styles.input, { flex: 1, color: p.text }]} />
                    <Pressable accessibilityRole="button" accessibilityLabel={`Set ${index + 1} weight unit: ${row.unit}. Change unit`} disabled={blocked}
                      style={styles.unit} onPress={() => Alert.alert('Weight unit', `Set ${index + 1}. The number will not be converted.`, [
                        { text: 'Pounds (lb)', onPress: () => entry.edit(row.key, { unit: 'lb' }) },
                        { text: 'Kilograms (kg)', onPress: () => entry.edit(row.key, { unit: 'kg' }) }, { text: 'Cancel', style: 'cancel' },
                      ])}><Text style={{ color: p.secondary, fontSize: 13 }}>{row.unit}</Text></Pressable>
                  </>}
                </View>
                <TextInput accessibilityLabel={`${exercise.name}, set ${index + 1}, reps`} value={row.reps} keyboardType="number-pad" maxLength={30}
                  editable={!blocked} selectTextOnFocus placeholder="—" placeholderTextColor={p.secondary} onChangeText={(reps) => entry.edit(row.key, { reps })}
                  style={[styles.reps, styles.box, styles.input, { color: p.text, borderColor: p.border }]} />
              </View>;
            })}
          </View>
        </ScrollView>
      </View>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" disabled={blocked || entry.rows.length >= 100} onPress={entry.add} style={styles.rowAction}>
          <Text style={{ color: p.accent, fontSize: 16 }}>+ Add set</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={blocked || !entry.rows.length} onPress={entry.removeLast} style={styles.rowAction}>
          <Text style={{ color: p.accent, fontSize: 16 }}>− Remove set</Text>
        </Pressable>
      </View>
      <Text accessibilityLiveRegion="polite" style={[styles.caption, { color: p.secondary }]}>
        {entry.pending ? 'Saving changes…' : entry.changed ? 'Unsaved sets' : entry.exercise.actual.length ? 'Saved' : 'Leave unperformed sets blank'}
      </Text>
      {entry.writeError ? <><Message text={entry.writeError} /><Action title="Retry" secondary disabled={blocked || entry.pending} onPress={entry.retry} /></> : null}
      {entry.error ? <Message text={entry.error} /> : null}
      {(entry.writeError || entry.error) && <Action title="Reload exercise" secondary disabled={blocked || entry.pending}
        onPress={() => Alert.alert('Reload stored changes?', 'Replace local edits with the latest stored values for this exercise.', [
          { text: 'Cancel', style: 'cancel' }, { text: 'Reload', onPress: () => { void entry.reload(); } },
        ])} />}
      <Action title={entry.saving ? 'Saving…' : 'Save sets'} disabled={blocked || !entry.changed} onPress={save} />
      {entry.changed && <Pressable accessibilityRole="button" disabled={blocked || entry.pending} style={styles.rowAction}
        onPress={() => Alert.alert('Reset changes?', 'Return to your saved sets.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset', style: 'destructive', onPress: () => { void entry.save(true); } }])}>
        <Text style={{ color: p.secondary, fontSize: 15 }}>Reset changes</Text>
      </Pressable>}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'stretch' },
  previous: { flex: 1.15 }, set: { flex: 0.6 }, weight: { flex: 1.4 }, reps: { flex: 0.85 },
  heading: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  caption: { fontSize: 14, textAlign: 'center' },
  box: { minHeight: 52, borderWidth: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  value: { fontSize: 14, textAlign: 'center' },
  input: { fontSize: 16, textAlign: 'center', minHeight: 50, paddingHorizontal: 4, paddingVertical: 8 },
  weightBox: { flexDirection: 'row' },
  unit: { minWidth: 28, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  rowAction: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
