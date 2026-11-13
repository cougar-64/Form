import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, assertDate, localDate, weekday, weekDates } from '../src/data/dates.ts';

test('calendar arithmetic keeps Monday–Sunday across years and leap days', () => {
  assert.deepEqual(weekDates('2027-01-01'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.equal(weekday('2027-01-03'), 7);
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2028-02-29', 1), '2028-03-01');
  for (const invalid of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-01', '0000-01-01', 'not a date']) {
    assert.throws(() => assertDate(invalid));
  }
});

test('local dates use device timezone; date arithmetic is stable across DST and travel', () => {
  const originalTimezone = process.env.TZ;
  try {
    for (const [zone, expected] of [['America/Denver', '2026-11-13'], ['Asia/Tokyo', '2026-11-14'], ['UTC', '2026-11-14']]) {
      process.env.TZ = zone;
      assert.equal(localDate(new Date('2026-11-14T01:30:00Z')), expected);
      assert.equal(addDays('2026-03-08', 1), '2026-03-09');
      assert.equal(addDays('2026-11-01', 1), '2026-11-02');
      assert.equal(weekDates('2026-11-01')[0], '2026-10-26');
    }
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});
