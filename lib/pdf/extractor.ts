import { ExtractedTask } from '../types/database';
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
  // Dynamically import pdf-parse
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

  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

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
    if (/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i.test(lower)) return true;
    if (/^(sun|mon|tue|wed|thu|fri|sat)$/i.test(lower)) return true;
    if (/^(page|calendar|schedule|planner|notes|to do|tasks|month|year)\b/i.test(lower)) return true;
    if (/^\d{1,2}\s*(am|pm)$/i.test(lower)) return true;
    if (/^[a-z]+\s+202[0-9]$/i.test(lower)) return true; // e.g. "August 2026"
    if (/^\d+$/.test(lower)) return true; // purely digits
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isNoiseLine(line)) continue;

    let matched = false;

    // Check if line is purely month + year header (e.g. "August 2026", "AUG 2026")
    if (/^[a-zA-Z]+\s+\d{4}$/i.test(line.trim())) {
      continue;
    }

    // Try pattern: Date Month -> Task (e.g. 20 August -> Motion graphics, 20 August 2026: Poster 4)
    const m1 = line.match(/^(?:(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)(?:\s+(\d{4}))?)\s*(?:[-–—:→>]+|\s+to\s+|\s+)\s*(.+)$/i);
    if (m1 && MONTH_NAMES[m1[2].toLowerCase()]) {
      const day = parseInt(m1[1], 10);
      const monthStr = m1[2].toLowerCase();
      const monthVal = MONTH_NAMES[monthStr];
      const yearVal = m1[3] ? parseInt(m1[3], 10) : finalYear;
      const taskName = sanitizeTaskName(m1[4]);

      if (day >= 1 && day <= 31 && taskName.length > 1 && !isNoiseLine(taskName) && !/^\d+$/.test(taskName)) {
        const dateKey = `${yearVal}-${String(monthVal).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        tasksMap.set(`${dateKey}_${taskName.toLowerCase()}`, {
          task_name: taskName,
          task_date: dateKey,
          reminder_date: calculateReminderDate(dateKey),
          reminder_time: options.defaultReminderTime || DEFAULT_REMINDER_TIME,
          recipient_phone: options.defaultRecipientPhone || '+917025219962',
          month: monthVal,
          year: yearVal,
          approved: true,
        });
        matched = true;
      }
    }

    // Try pattern: Month Date -> Task (e.g. August 20 -> Motion graphics, August 20, 2026 - Motion graphics)
    if (!matched) {
      const m2 = line.match(/^([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\s*(?:[-–—:→>]+|\s+)\s*(.+)$/i);
      if (m2 && MONTH_NAMES[m2[1].toLowerCase()]) {
        const monthVal = MONTH_NAMES[m2[1].toLowerCase()];
        const day = parseInt(m2[2], 10);
        const yearVal = m2[3] ? parseInt(m2[3], 10) : finalYear;
        const taskName = sanitizeTaskName(m2[4]);

        if (day >= 1 && day <= 31 && taskName.length > 1 && !isNoiseLine(taskName) && !/^\d+$/.test(taskName)) {
          const dateKey = `${yearVal}-${String(monthVal).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          tasksMap.set(`${dateKey}_${taskName.toLowerCase()}`, {
            task_name: taskName,
            task_date: dateKey,
            reminder_date: calculateReminderDate(dateKey),
            reminder_time: options.defaultReminderTime || DEFAULT_REMINDER_TIME,
            recipient_phone: options.defaultRecipientPhone || '+917025219962',
            month: monthVal,
            year: yearVal,
            approved: true,
          });
          matched = true;
        }
      }
    }

    // Try pattern: "20 - Motion graphics" or "20 -> Motion graphics" or "20 : Motion graphics"
    if (!matched) {
      const m3 = line.match(/^(\d{1,2})(?:st|nd|rd|th)?\s*[-–—:→>]\s*(.+)$/i);
      if (m3) {
        const day = parseInt(m3[1], 10);
        const taskName = sanitizeTaskName(m3[2]);

        if (day >= 1 && day <= 31 && taskName.length > 1 && !isNoiseLine(taskName)) {
          const dateKey = `${finalYear}-${String(finalMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          tasksMap.set(`${dateKey}_${taskName.toLowerCase()}`, {
            task_name: taskName,
            task_date: dateKey,
            reminder_date: calculateReminderDate(dateKey),
            reminder_time: options.defaultReminderTime || DEFAULT_REMINDER_TIME,
            recipient_phone: options.defaultRecipientPhone || '+917025219962',
            month: finalMonth,
            year: finalYear,
            approved: true,
          });
          matched = true;
        }
      }
    }
  }

  // Pattern 2: Multiline Grid / Cell Calendar parsing
  // Often in grid PDFs, a line has the date number "20", and the subsequent line(s) contain the task "Motion graphics"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const singleNumberMatch = line.match(/^(\d{1,2})(?:st|nd|rd|th)?$/);

    if (singleNumberMatch) {
      const day = parseInt(singleNumberMatch[1], 10);
      if (day >= 1 && day <= 31) {
        // Look ahead for the task title
        for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
          const nextLine = lines[j];
          if (/^\d{1,2}$/.test(nextLine)) {
            // Next cell's date number, stop looking
            break;
          }
          if (isNoiseLine(nextLine)) continue;

          const taskName = sanitizeTaskName(nextLine);
          if (taskName.length > 1 && !isNoiseLine(taskName)) {
            const dateKey = `${finalYear}-${String(finalMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const mapKey = `${dateKey}_${taskName.toLowerCase()}`;
            if (!tasksMap.has(mapKey)) {
              tasksMap.set(mapKey, {
                task_name: taskName,
                task_date: dateKey,
                reminder_date: calculateReminderDate(dateKey),
                reminder_time: options.defaultReminderTime || DEFAULT_REMINDER_TIME,
                recipient_phone: options.defaultRecipientPhone || '+917025219962',
                month: finalMonth,
                year: finalYear,
                approved: true,
              });
            }
            break;
          }
        }
      }
    }
  }

  // Pattern 3: Tabular Grid row parsing with multiple numbers and tasks
  // E.g., "Sun Mon Tue Wed Thu Fri Sat" then "1 2 3 4 5 6 7" then "Poster 1 Motion graphics Poster 2..."
  // Also handles inline entries like: "20 Motion graphics", "25 Poster 5", "18 Scripted"
  for (const line of lines) {
    if (isNoiseLine(line)) continue;
    const inlineMatch = line.match(/^(\d{1,2})\s+([A-Za-z][A-Za-z0-9\s,._\-\/]{2,})$/);
    if (inlineMatch) {
      const day = parseInt(inlineMatch[1], 10);
      const potentialTask = sanitizeTaskName(inlineMatch[2]);
      if (
        day >= 1 &&
        day <= 31 &&
        potentialTask.length > 1 &&
        !isNoiseLine(potentialTask) &&
        !MONTH_NAMES[potentialTask.toLowerCase()]
      ) {
        const dateKey = `${finalYear}-${String(finalMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const mapKey = `${dateKey}_${potentialTask.toLowerCase()}`;
        if (!tasksMap.has(mapKey)) {
          tasksMap.set(mapKey, {
            task_name: potentialTask,
            task_date: dateKey,
            reminder_date: calculateReminderDate(dateKey),
            reminder_time: options.defaultReminderTime || DEFAULT_REMINDER_TIME,
            recipient_phone: options.defaultRecipientPhone || '+917025219962',
            month: finalMonth,
            year: finalYear,
            approved: true,
          });
        }
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
