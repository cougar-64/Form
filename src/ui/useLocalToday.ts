import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { localDate } from '../data/dates';

export function useLocalToday(): string {
  const [today, setToday] = useState(() => localDate());
  useFocusEffect(useCallback(() => { setToday(localDate()); }, []));
  useEffect(() => {
    const refresh = () => setToday(localDate());
    const interval = setInterval(refresh, 30_000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { clearInterval(interval); subscription.remove(); };
  }, []);
  return today;
}
