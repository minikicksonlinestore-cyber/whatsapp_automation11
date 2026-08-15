import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateReminderDate, formatPhoneForWhatsApp, normalizePhoneNumber } from '../lib/date/calculator.ts';
import { validateWhatsAppConfig } from '../lib/validation/env.ts';

test('WhatsApp Service - Validates recipient numbers and phone stripping for Meta API', () => {
  const recipientInput = '+91 7025219962';
  const normalized = normalizePhoneNumber(recipientInput);
  assert.equal(normalized, '+917025219962');

  const metaRecipient = formatPhoneForWhatsApp(normalized);
  assert.equal(metaRecipient, '917025219962');
});

test('WhatsApp Service - Configuration validation fails safely when tokens are absent', () => {
  const validation = validateWhatsAppConfig();
  // In test environment without .env, it should report what's missing safely without throwing exceptions
  assert.ok(typeof validation.isValid === 'boolean');
});

test('Cron Logic - Accurate Reminder Date 1-Day Prior Computation', () => {
  // Test case from requirements:
  // Task date: 20 August 2026
  // Reminder date: 19 August 2026
  const taskDate = '2026-08-20';
  const reminderDate = calculateReminderDate(taskDate);
  assert.equal(reminderDate, '2026-08-19');

  // Next test case:
  // Task date: 25 August 2026
  // Reminder date: 24 August 2026
  assert.equal(calculateReminderDate('2026-08-25'), '2026-08-24');
});
