import { Suspense } from 'react';
import { ActivityIndicator, Button } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { migrateDatabase } from '../data/migrations';
import { Body, Screen } from '../ui/Screen';

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <Screen title="Unable to open Form" subtitle="Your saved data has not been reset.">
      <Body>Form could not initialize. If this follows an app downgrade, install the newer version before retrying.</Body>
      <Button title="Try again" onPress={() => { void retry(); }} />
    </Screen>
  );
}

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  return (
    <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
      <Suspense fallback={<Screen title="Form" subtitle="Opening your local data…"><ActivityIndicator accessibilityLabel="Loading Form" /></Screen>}>
        <SQLiteProvider databaseName="form.db" onInit={migrateDatabase} useSuspense>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style={dark ? 'light' : 'dark'} />
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}
