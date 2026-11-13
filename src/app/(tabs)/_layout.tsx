import { Link, Tabs } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { usePalette } from '../../ui/Screen';

export default function TabLayout() {
  const palette = usePalette();
  return (
    <Tabs screenOptions={{
      headerTitle: 'Form',
      headerStyle: { backgroundColor: palette.background },
      headerTintColor: palette.text,
      tabBarActiveTintColor: palette.accent,
      tabBarInactiveTintColor: palette.secondary,
      tabBarStyle: { backgroundColor: palette.card },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Text accessible={false} style={{ color, fontSize: 24 }}>⌂</Text> }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: ({ color }) => <Text accessible={false} style={{ color, fontSize: 24 }}>▦</Text> }} />
      <Tabs.Screen name="nutrition" options={{ title: 'Nutrition', tabBarIcon: ({ color }) => <Text accessible={false} style={{ color, fontSize: 24 }}>◒</Text> }} />
      <Tabs.Screen name="progress" options={{
        title: 'My Progress',
        tabBarIcon: ({ color }) => <Text accessible={false} style={{ color, fontSize: 24 }}>↗</Text>,
        headerRight: () => (
          <Link href="/settings" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="Open settings" style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' }}>
              <Text style={{ color: palette.accent, fontSize: 17 }}>Settings</Text>
            </Pressable>
          </Link>
        ),
      }} />
    </Tabs>
  );
}
