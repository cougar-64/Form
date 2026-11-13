import { Suspense } from 'react';
import { ActivityIndicator, Button } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack, type ErrorBoundaryProps } from 'expo-router';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { migrateDatabase } from '../data/migrations';
import { initializeSchedule } from '../data/schedule';
import { Body, Screen } from '../ui/Screen';

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <Screen title="Unable to open Form" subtitle="Your saved data has not been reset.">
      <Body>Form could not initialize. If this follows an app downgrade, install the newer version before retrying.</Body>
      <Button title="Try again" onPress={() => { void retry(); }} />
    </Screen>
  );
}

async function initializeDatabase(database: SQLiteDatabase) {
  await migrateDatabase(database);
  await initializeSchedule(database);
}

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  return (
    <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
      <Suspense fallback={<Screen title="Form" subtitle="Opening your local data…"><ActivityIndicator accessibilityLabel="Loading Form" /></Screen>}>
        <SQLiteProvider databaseName="form.db" onInit={initializeDatabase} useSuspense>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="templates" options={{ title: 'Weekly templates' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="plan/[date]" options={{ title: 'Planned workout', headerBackTitle: 'Calendar' }} />
            <Stack.Screen name="workout/[weekday]" options={{ title: 'Workout builder', headerBackTitle: 'Templates' }} />
          </Stack>
          <StatusBar style={dark ? 'light' : 'dark'} />
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}
