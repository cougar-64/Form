import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { usePalette, useTextAlignment } from './Screen';

export function Action({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, { borderColor: p.accent, backgroundColor: secondary ? p.card : p.accent, opacity: disabled || pressed ? 0.55 : 1 }]}>
      <Text style={{ color: secondary ? p.accent : p.background, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const p = usePalette();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: p.text, fontSize: 16, fontWeight: '600' }}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={p.secondary} {...props}
        style={[styles.input, { color: p.text, backgroundColor: p.card, borderColor: p.border }, props.multiline && { minHeight: 100, textAlignVertical: 'top' }, props.style]} />
    </View>
  );
}

export function Choices<T extends string>({ label, value, options, onChange, disabled = false }: {
  label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void; disabled?: boolean;
}) {
  const p = usePalette();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 8 }}>
      <Text style={{ color: p.text, fontSize: 16, fontWeight: '600' }}>{label}</Text>
      {options.map((option) => (
        <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label}
          accessibilityState={{ checked: value === option.value, disabled }} disabled={disabled} onPress={() => onChange(option.value)}
          style={[styles.button, { borderColor: value === option.value ? p.accent : p.border, backgroundColor: value === option.value ? p.accent : p.card, opacity: disabled ? 0.55 : 1 }]}>
          <Text style={{ fontSize: 16, color: value === option.value ? p.background : p.text }}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Message({ text }: { text: string }) {
  const p = usePalette();
  const textAlign = useTextAlignment();
  return <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: p.text, fontSize: 17, fontWeight: '600', textAlign }}>{text}</Text>;
}

const styles = StyleSheet.create({
  button: { minHeight: 48, justifyContent: 'center', padding: 12, borderWidth: 1, borderRadius: 12 },
  input: { minHeight: 48, padding: 12, borderRadius: 10, borderWidth: 1, fontSize: 17 },
});
