import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateReminderDate,
  formatReadableDate,
  normalizeTimeString,
  normalizePhoneNumber,
  formatPhoneForWhatsApp,
  getNowInTimezone,
} from '../lib/date/calculator.ts';

test('Date Calculator - Calculates exactly 1 day prior for task date', () => {
  // Test Case: 20 August 2026 -> Reminder: 19 August 2026
  assert.equal(calculateReminderDate('2026-08-20'), '2026-08-19');

  // Test Case: 25 August 2026 -> Reminder: 24 August 2026
  assert.equal(calculateReminderDate('2026-08-25'), '2026-08-24');

  // Test Month boundary: 1 September 2026 -> Reminder: 31 August 2026
  assert.equal(calculateReminderDate('2026-09-01'), '2026-08-31');

  // Test Year boundary: 1 January 2027 -> Reminder: 31 December 2026
  assert.equal(calculateReminderDate('2027-01-01'), '2026-12-31');

  // Test Leap year: 1 March 2024 -> Reminder: 29 February 2024
  assert.equal(calculateReminderDate('2024-03-01'), '2024-02-29');
});

test('Date Calculator - Readable Date Formatting', () => {
  assert.equal(formatReadableDate('2026-08-20'), '20 August 2026');
  assert.equal(formatReadableDate('2026-08-25'), '25 August 2026');
});

test('Date Calculator - Normalizes Time and Phone Numbers', () => {
  assert.equal(normalizeTimeString('18:00'), '18:00:00');
  assert.equal(normalizeTimeString('9:30'), '09:30:00');
  assert.equal(normalizeTimeString('18:00:00'), '18:00:00');

  assert.equal(normalizePhoneNumber('+91 7025219962'), '+917025219962');
  assert.equal(normalizePhoneNumber('7025219962'), '+917025219962');
  assert.equal(formatPhoneForWhatsApp('+91 7025219962'), '917025219962');
});

test('Date Calculator - Timezone in Asia/Kolkata evaluates properly', () => {
  const result = getNowInTimezone('Asia/Kolkata');
  assert.ok(result.currentDate.match(/^\d{4}-\d{2}-\d{2}$/));
  assert.ok(result.currentTime.match(/^\d{2}:\d{2}:\d{2}$/));
});
