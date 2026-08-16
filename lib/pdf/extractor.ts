import type { ExtractedTask } from '../types/database';
import { calculateReminderDate, DEFAULT_REMINDER_TIME } from '../date/calculator';

const MONTH_NAMES: { [key: string]: number } = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const WEEKDAYS = new Set([
  'mon', 'monday', 'tue', 'tues', 'tuesday', 'wed', 'wednesday',
  'thu', 'thur', 'thurs', 'thursday', 'fri', 'friday',
  'sat', 'saturday', 'sun', 'sunday',
]);

export interface ParseCalendarOptions {
  defaultYear?: number;
  defaultMonth?: number;
  defaultRecipientPhone?: string;
  defaultReminderTime?: string;
}

/**
 * Extracts tasks and their exact calendar dates from PDF text content or Buffer.
 */
export async function extractTasksFromPdf(
  pdfBuffer: Buffer,
  options: ParseCalendarOptions = {}
): Promise<{ tasks: ExtractedTask[]; rawText: string; detectedMonth?: number; detectedYear?: number }> {
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(pdfBuffer);
  const rawText = data.text || '';

  const parsed = parseCalendarText(rawText, options);
  return {
    ...parsed,
    rawText,
  };
}

/**
 * Parses raw text extracted from a calendar PDF into structured tasks with accurate dates.
 */
export function parseCalendarText(
  text: string,
  options: ParseCalendarOptions = {}
): { tasks: ExtractedTask[]; detectedMonth?: number; detectedYear?: number } {
  const currentYear = options.defaultYear || new Date().getFullYear();
  let detectedYear = options.defaultYear;
  let detectedMonth = options.defaultMonth;

  // Split lines & remove pure noise/single brand letters
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !/^[A-Z]$/.test(line));

  // 1. Scan for Year and Month across the document
  for (const line of lines) {
    const lower = line.toLowerCase();

    // Check for 4-digit year (2020 - 2035)
    const yearMatch = line.match(/\b(202[0-9]|203[0-9])\b/);
    if (yearMatch && !detectedYear) {
      detectedYear = parseInt(yearMatch[1], 10);
    }

    // Check for month names
    for (const [monthKey, monthNum] of Object.entries(MONTH_NAMES)) {
      const regex = new RegExp(`\\b${monthKey}\\b`, 'i');
      if (regex.test(lower) && !detectedMonth) {
        detectedMonth = monthNum;
      }
    }
  }

  const finalYear = detectedYear || currentYear;
  const finalMonth = detectedMonth || (new Date().getMonth() + 1);

  const tasksMap = new Map<string, ExtractedTask>();

  const sanitizeTaskName = (name: string): string => {
    return name
      .replace(/^[\s\-–—:→>•*#]+/, '')
      .replace(/[\s\-–—:→>•*#]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const isNoiseLine = (line: string): boolean => {
    const lower = line.toLowerCase().trim();
    if (lower.length === 0) return true;
    if (WEEKDAYS.has(lower)) return true;
    if (/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)(\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday))*$/i.test(lower)) return true;
    if (/^(sun|mon|tue|wed|thu|fri|sat)(\s+(sun|mon|tue|wed|thu|fri|sat))*$/i.test(lower)) return true;
    if (/^(page|calendar|schedule|planner|notes|to do|tasks|month|year|babios)\b/i.test(lower)) return true;
    if (/^\d{1,2}\s*(am|pm)$/i.test(lower)) return true;
    if (/^[a-z]+\s+202[0-9]$/i.test(lower)) return true;
    if (/^[\d\s]+$/.test(lower)) return true; // only digits and spaces (e.g. "4 5 6 7", "9 10 11")
    return false;
  };

  const addTask = (day: number, taskName: string, monthVal = finalMonth, yearVal = finalYear) => {
    if (day < 1 || day > 31) return;
    const cleanName = sanitizeTaskName(taskName);
    if (!cleanName || cleanName.length < 2 || isNoiseLine(cleanName) || /^[\d\s]+$/.test(cleanName)) return;

    const dateKey = `${yearVal}-${String(monthVal).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const mapKey = `${dateKey}_${cleanName.toLowerCase()}`;
    if (!tasksMap.has(mapKey)) {
      tasksMap.set(mapKey, {
        task_name: cleanName,
        task_date: dateKey,
        reminder_date: calculateReminderDate(dateKey),
        reminder_time: options.defaultReminderTime || DEFAULT_REMINDER_TIME,
        recipient_phone: options.defaultRecipientPhone || '+917025219962',
        month: monthVal,
        year: yearVal,
        approved: true,
      });
    }
  };

  // PASS 1: Explicit Date -> Task line parsing
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isNoiseLine(line)) continue;

    // Pattern 1a: "20 August -> Motion graphics" or "20 August 2026: Poster 4"
    const m1 = line.match(/^(?:(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)(?:\s+(\d{4}))?)\s*(?:[-–—:→>]+|\s+to\s+|\s+)\s*(.+)$/i);
    if (m1 && MONTH_NAMES[m1[2].toLowerCase()]) {
      const day = parseInt(m1[1], 10);
      const monthVal = MONTH_NAMES[m1[2].toLowerCase()];
      const yearVal = m1[3] ? parseInt(m1[3], 10) : finalYear;
      addTask(day, m1[4], monthVal, yearVal);
      continue;
    }

    // Pattern 1b: "August 20 -> Motion graphics"
    const m2 = line.match(/^([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\s*(?:[-–—:→>]+|\s+)\s*(.+)$/i);
    if (m2 && MONTH_NAMES[m2[1].toLowerCase()]) {
      const monthVal = MONTH_NAMES[m2[1].toLowerCase()];
      const day = parseInt(m2[2], 10);
      const yearVal = m2[3] ? parseInt(m2[3], 10) : finalYear;
      addTask(day, m2[4], monthVal, yearVal);
      continue;
    }

    // Pattern 1c: "20 - Motion graphics" or "20 : Motion graphics"
    const m3 = line.match(/^(\d{1,2})(?:st|nd|rd|th)?\s*[-–—:→>]\s*(.+)$/i);
    if (m3) {
      addTask(parseInt(m3[1], 10), m3[2]);
      continue;
    }
  }

  // PASS 2: Sequential Calendar Block Stream Parsing (handles Table Grid OCR flow)
  // Handles:
  // "1", "pin poster 1", "2", "pin poster 2", "3", "pin poster 3", "4 5 6 7", "Motion graphics [1]", "8", "9 10 11", "poster 4", ...
  let currentActiveDays: number[] = [];
  let pendingTaskLines: string[] = [];

  const flushPending = () => {
    if (currentActiveDays.length > 0 && pendingTaskLines.length > 0) {
      const fullTask = pendingTaskLines.join(' ');
      // The task belongs to the last day in the sequence of numbers immediately preceding it
      const targetDay = currentActiveDays[currentActiveDays.length - 1];
      addTask(targetDay, fullTask);
    }
    pendingTaskLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isNoiseLine(line) && !/^\d+(\s+\d+)*$/.test(line)) {
      continue;
    }

    // Check if line contains one or more calendar day numbers (e.g. "1", "4 5 6 7", "9 10 11", "12 13 14 15", "17 18 19 20 21 22")
    const numberSeriesMatch = line.match(/^(\d{1,2}(?:\s+\d{1,2})*)$/);
    if (numberSeriesMatch) {
      // Flush any accumulated task for previous days
      flushPending();
      const days = numberSeriesMatch[1]
        .split(/\s+/)
        .map(n => parseInt(n, 10))
        .filter(n => n >= 1 && n <= 31);
      currentActiveDays = days;
      continue;
    }

    // Check if line is a task description (e.g. "pin poster 1", "Motion graphics [1]", "[independence day ]")
    if (!isNoiseLine(line) && currentActiveDays.length > 0) {
      pendingTaskLines.push(line);
    }
  }
  // Flush final pending item if any
  flushPending();

  // PASS 3: Inline entry parsing (e.g. "20 Motion graphics", "25 poster 5 [onam]")
  for (const line of lines) {
    if (isNoiseLine(line)) continue;
    const inlineMatch = line.match(/^(\d{1,2})\s+([A-Za-z\[][A-Za-z0-9\s,._\-\/\[\]()]{2,})$/);
    if (inlineMatch) {
      const day = parseInt(inlineMatch[1], 10);
      const potentialTask = inlineMatch[2];
      if (!MONTH_NAMES[potentialTask.toLowerCase()]) {
        addTask(day, potentialTask);
      }
    }
  }

  // Sort tasks chronologically by task_date
  const tasks = Array.from(tasksMap.values()).sort((a, b) => a.task_date.localeCompare(b.task_date));

  return {
    tasks,
    detectedMonth: finalMonth,
    detectedYear: finalYear,
  };
}
