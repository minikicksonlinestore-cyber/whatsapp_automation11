import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCalendarText } from '../lib/pdf/extractor.ts';

test('PDF Extractor - Parses explicit Date -> Task patterns correctly', () => {
  const sampleCalendarText = `
    August 2026 Editorial Calendar
    Sun Mon Tue Wed Thu Fri Sat
    20 August -> Motion graphics
    22 August -> Scripted
    25 August -> Poster 5
    28 August -> Poster 6
  `;

  const result = parseCalendarText(sampleCalendarText, { defaultYear: 2026 });
  assert.equal(result.detectedYear, 2026);
  assert.equal(result.detectedMonth, 8);
  assert.equal(result.tasks.length, 4);

  const motionGraphics = result.tasks.find(t => t.task_name === 'Motion graphics');
  assert.ok(motionGraphics);
  assert.equal(motionGraphics.task_date, '2026-08-20');
  assert.equal(motionGraphics.reminder_date, '2026-08-19');

  const poster5 = result.tasks.find(t => t.task_name === 'Poster 5');
  assert.ok(poster5);
  assert.equal(poster5.task_date, '2026-08-25');
  assert.equal(poster5.reminder_date, '2026-08-24');
});

test('PDF Extractor - Parses visual grid cell layouts', () => {
  const gridCalendarText = `
    AUGUST 2026
    18
    Scripted
    19
    Poster 4
    20
    Motion graphics
    25
    Poster 5
    27
    Poster 6
  `;

  const result = parseCalendarText(gridCalendarText, { defaultYear: 2026 });
  assert.equal(result.detectedMonth, 8);
  assert.equal(result.tasks.length, 5);

  const poster4 = result.tasks.find(t => t.task_name === 'Poster 4');
  assert.ok(poster4);
  assert.equal(poster4.task_date, '2026-08-19');
  assert.equal(poster4.reminder_date, '2026-08-18');

  const motionGraphics = result.tasks.find(t => t.task_name === 'Motion graphics');
  assert.ok(motionGraphics);
  assert.equal(motionGraphics.task_date, '2026-08-20');
  assert.equal(motionGraphics.reminder_date, '2026-08-19');
});

test('PDF Extractor - Parses inline number + task formats', () => {
  const inlineCalendarText = `
    August 2026
    15 Poster 1
    18 Scripted
    20 Motion graphics
    25 Poster 5
  `;

  const result = parseCalendarText(inlineCalendarText, { defaultYear: 2026 });
  assert.equal(result.tasks.length, 4);

  const scripted = result.tasks.find(t => t.task_name === 'Scripted');
  assert.ok(scripted);
  assert.equal(scripted.task_date, '2026-08-18');
  assert.equal(scripted.reminder_date, '2026-08-17');
});
