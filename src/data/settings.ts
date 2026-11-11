import type { SQLiteDatabase } from 'expo-sqlite';

export type WeightUnit = 'lb' | 'kg';

export async function readWeightUnit(database: SQLiteDatabase): Promise<WeightUnit> {
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?', 'weight_unit',
  );
  if (row?.value !== 'lb' && row?.value !== 'kg') {
    throw new Error('The saved weight unit could not be read.');
  }
  return row.value;
}

export async function saveWeightUnit(database: SQLiteDatabase, unit: WeightUnit): Promise<void> {
  await database.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    'weight_unit', unit,
  );
}
