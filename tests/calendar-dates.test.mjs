import test from 'node:test';
import assert from 'node:assert/strict';
import {daysOfMonth} from '../lib/calendar.ts';

test('team month calendar generates every day of 28, 29, 30, and 31 day months',()=>{
  assert.equal(daysOfMonth('2026-02').length,28);
  assert.equal(daysOfMonth('2028-02').length,29);
  assert.equal(daysOfMonth('2026-04').length,30);
  assert.equal(daysOfMonth('2026-01').length,31);
});

test('team month calendar returns stable ISO dates in order',()=>{
  const days=daysOfMonth('2026-11');
  assert.equal(days[0],'2026-11-01');
  assert.equal(days.at(-1),'2026-11-30');
  assert.deepEqual(days.slice(10,13),['2026-11-11','2026-11-12','2026-11-13']);
});

test('team month calendar rejects invalid month selections',()=>{
  assert.throws(()=>daysOfMonth('2026-13'),/Ungültiger Monat/);
});
