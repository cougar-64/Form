import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

export function usePalette() {
  const dark = useColorScheme() === 'dark';
  return dark
    ? { background: '#101915', card: '#1b2922', text: '#f1f6f2', secondary: '#b5c7bc', accent: '#a9e3ba', border: '#41574a' }
    : { background: '#f5f7f2', card: '#ffffff', text: '#162c20', secondary: '#4d6355', accent: '#205c39', border: '#bccbbf' };
}

export function Screen({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle: string }>) {
  const palette = usePalette();
  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.screen}>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: palette.secondary }]}>{subtitle}</Text>
      {children}
    </ScrollView>
  );
}

export function Card({ title, children }: PropsWithChildren<{ title: string }>) {
  const palette = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text accessibilityRole="header" style={[styles.cardTitle, { color: palette.text }]}>{title}</Text>
      {children}
    </View>
  );
}

export function Body({ children }: PropsWithChildren) {
  const palette = usePalette();
  return <Text style={[styles.body, { color: palette.secondary }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { padding: 24, gap: 20, paddingBottom: 40 },
  title: { fontSize: 34, fontWeight: '700' },
  subtitle: { fontSize: 17, lineHeight: 25 },
  card: { padding: 20, borderRadius: 18, borderWidth: 1, gap: 12 },
  cardTitle: { fontSize: 21, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 26 },
});
