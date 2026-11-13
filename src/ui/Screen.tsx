import { createContext, useContext, type PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

export function usePalette() {
  const dark = useColorScheme() === 'dark';
  return dark
    ? { background: '#101915', card: '#1b2922', text: '#f1f6f2', secondary: '#b5c7bc', accent: '#a9e3ba', border: '#41574a' }
    : { background: '#f5f7f2', card: '#ffffff', text: '#162c20', secondary: '#4d6355', accent: '#205c39', border: '#bccbbf' };
}

const TextAlignmentContext = createContext<'left' | 'center'>('left');

export function useTextAlignment() {
  return useContext(TextAlignmentContext);
}

export function Screen({ title, subtitle, centered = false, children }: PropsWithChildren<{ title: string; subtitle: string; centered?: boolean }>) {
  const palette = usePalette();
  const textAlign = centered ? 'center' : 'left';
  return (
    <TextAlignmentContext.Provider value={textAlign}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={{ backgroundColor: palette.background }} contentContainerStyle={styles.screen}>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.text, textAlign }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: palette.secondary, textAlign }]}>{subtitle}</Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </TextAlignmentContext.Provider>
  );
}

export function Card({ title, children }: PropsWithChildren<{ title: string }>) {
  const palette = usePalette();
  const textAlign = useTextAlignment();
  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text accessibilityRole="header" style={[styles.cardTitle, { color: palette.text, textAlign }]}>{title}</Text>
      {children}
    </View>
  );
}

export function Body({ children }: PropsWithChildren) {
  const palette = usePalette();
  const textAlign = useTextAlignment();
  return <Text style={[styles.body, { color: palette.secondary, textAlign }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { padding: 24, gap: 20, paddingBottom: 40 },
  title: { fontSize: 34, fontWeight: '700' },
  subtitle: { fontSize: 17, lineHeight: 25 },
  card: { padding: 20, borderRadius: 18, borderWidth: 1, gap: 12 },
  cardTitle: { fontSize: 21, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 26 },
});
