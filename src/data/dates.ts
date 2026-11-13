// Dates assigned to workouts are calendar dates, not UTC timestamps.
export function localDate(now = new Date()): string {
  return `${now.getFullYear().toString().padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function assertDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) === '0000') throw new Error('Use a valid date in YYYY-MM-DD format.');
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Use a valid calendar date.');
}

export function addDays(value: string, count: number): string {
  assertDate(value);
  if (!Number.isInteger(count)) throw new Error('Use a whole number of days.');
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  const result = date.toISOString().slice(0, 10);
  assertDate(result);
  return result;
}

export function weekday(value: string): number {
  assertDate(value);
  return new Date(`${value}T12:00:00Z`).getUTCDay() || 7;
}

export function weekDates(containing: string): string[] {
  const monday = addDays(containing, 1 - weekday(containing));
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function displayDate(value: string): string {
  assertDate(value);
  // Noon in the current locale avoids interpreting a bare ISO date as UTC.
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
