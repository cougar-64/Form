import { useState } from 'react';
import { Alert } from 'react-native';
import { usePreventRemove } from 'expo-router';

export function usePendingSetGuard({ pending, saving, failed }: { pending: boolean; saving: boolean; failed: boolean }) {
  const [leaving, setLeaving] = useState(false);
  usePreventRemove(!leaving && (pending || saving || failed), ({ repeat }) => {
    if (pending || saving) { Alert.alert('Saving changes', 'Please wait for saving to finish.'); return; }
    Alert.alert('Leave without the latest edits?', 'These changes could not be saved. Previously recorded sets and the last stored changes remain unchanged.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => { setLeaving(true); repeat(); } },
    ]);
  });
}
