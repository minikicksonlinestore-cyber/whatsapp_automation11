import type { ExtractedTask } from '../types/database';
import {
  calculateReminderDate,
  DEFAULT_REMINDER_TIME,
} from '../date/calculator';

const MONTH_NAMES: { [key: string]: number } = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const WEEKDAYS = new Set([
  'mon',
  'monday',
  'tue',
  'tues',
  'tuesday',
  'wed',
  'wednesday',
  'thu',
  'thur',
  'thurs',
  'thursday',
  'fri',
  'friday',
  'sat',
  'saturday',
  'sun',
  'sunday',
]);

export interface ParseCalendarOptions {
  defaultYear?: number;
  defaultMonth?: number;
  defaultRecipientPhone?: string;
  defaultReminderTime?: string;
}

type ParsedTaskParts = {
  clientName?: string;
  taskName: string;
};

type PendingTaskLine = {
  text: string;
  clientName?: string;
};

function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ÃŽâ€œÃƒâ€¡ÃƒÂ´ÃŽâ€œÃƒâ€¡ÃƒÂ¶]/g, 'Ã¢â‚¬â€œ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeTaskName(name: string): string {
  return normalizeText(name)
    .replace(/^[\s\-Ã¢â‚¬â€œÃ¢â‚¬â€:Ã¢â€ â€™>Ã¢â‚¬Â¢*#]+/, '')
    .replace(/[\s\-Ã¢â‚¬â€œÃ¢â‚¬â€:Ã¢â€ â€™>Ã¢â‚¬Â¢*#]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanClientName(name: string): string {
  return normalizeText(name)
    .replace(
      /^(client|brand|company|project|account)\s*[:\-Ã¢â‚¬â€œÃ¢â‚¬â€]\s*/i,
      ''
    )
    .replace(/^[\s\-Ã¢â‚¬â€œÃ¢â‚¬â€:Ã¢â€ â€™>Ã¢â‚¬Â¢*#]+/, '')
    .replace(/[\s\-Ã¢â‚¬â€œÃ¢â‚¬â€:Ã¢â€ â€™>Ã¢â‚¬Â¢*#]+$/, '')
    .trim();
}

function isValidClientName(name?: string | null): boolean {
  if (!name) return false;

  const clean = cleanClientName(name);

  if (!clean || clean.length < 2) return false;

  const lower = clean.toLowerCase();

  if (WEEKDAYS.has(lower)) return false;
  if (MONTH_NAMES[lower]) return false;
  if (/^\d+$/.test(lower)) return false;

  if (
    /^(page|calendar|schedule|planner|notes|to do|tasks|month|year)$/i.test(
      lower
    )
  ) {
    return false;
  }

  if (/^[\d\s\-Ã¢â‚¬â€œÃ¢â‚¬â€:]+$/.test(clean)) return false;

  return true;
}

function extractClientAndTask(
  rawTask: string,
  sectionClientName?: string
): ParsedTaskParts {
  const clean = sanitizeTaskName(rawTask);

  // Explicit separators commonly used in client/task PDFs:
  // Scripted Ã¢â‚¬â€œ Reel 4
  // Scripted - Reel 4
  // Scripted: Reel 4
  const explicitMatch = clean.match(
    /^(.{2,80}?)\s+(?:Ã¢â‚¬â€œ|Ã¢â‚¬â€|-|:)\s+(.{2,})$/
  );

  if (explicitMatch) {
    const left = cleanClientName(explicitMatch[1]);
    const right = sanitizeTaskName(explicitMatch[2]);

    if (
      isValidClientName(left) &&
      right.length >= 2
    ) {
      return {
        clientName: left,
        taskName: right,
      };
    }
  }

  // Prefix form:
  // Scripted Reel 4
  if (sectionClientName) {
    const section = cleanClientName(sectionClientName);

    const lowerClean = clean.toLowerCase();
    const lowerSection = section.toLowerCase();

    if (
      lowerClean.startsWith(
        `${lowerSection} `
      )
    ) {
      return {
        clientName: section,
        taskName: sanitizeTaskName(
          clean.slice(section.length)
        ),
      };
    }
  }

  return {
    clientName: isValidClientName(sectionClientName)
      ? cleanClientName(sectionClientName!)
      : undefined,
    taskName: clean,
  };
}

function looksLikeClientHeader(line: string): boolean {
  const clean = normalizeText(line);

  if (!isValidClientName(clean)) return false;

  const lower = clean.toLowerCase();

  // Explicit labels.
  if (
    /^(client|brand|company|project|account)\s*[:\-Ã¢â‚¬â€œÃ¢â‚¬â€]/i.test(
      clean
    )
  ) {
    return true;
  }

  // Avoid date/task looking lines.
  if (
    /^\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+/.test(clean)
  ) {
    return false;
  }

  if (
    /^[a-zA-Z]+\s+\d{1,2}/.test(clean)
  ) {
    return false;
  }

  if (
    /^\d{1,2}\s*[-Ã¢â‚¬â€œÃ¢â‚¬â€:Ã¢â€ â€™>]/.test(clean)
  ) {
    return false;
  }

  if (/^\d+$/.test(lower)) return false;

  // A short standalone non-sentence line is often a client heading.
  const words = clean.split(/\s+/);

  if (words.length <= 5 && !/[.!?]$/.test(clean)) {
    return true;
  }

  return false;
}

function isNoiseLine(line: string): boolean {
  const lower = normalizeText(line).toLowerCase();

  if (lower.length === 0) return true;

  if (WEEKDAYS.has(lower)) return true;

  if (
    /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)(\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday))*$/i.test(
      lower
    )
  ) {
    return true;
  }

  if (
    /^(sun|mon|tue|thu|wed|fri|sat)(\s+(sun|mon|tue|thu|wed|fri|sat))*$/i.test(
      lower
    )
  ) {
    return true;
  }

  if (
    /^(page|calendar|schedule|planner|notes|to do|tasks|month|year)\b/i.test(
      lower
    )
  ) {
    return true;
  }

  if (/^\d{1,2}\s*(am|pm)$/i.test(lower)) {
    return true;
  }

  if (/^[a-z]+\s+202[0-9]$/i.test(lower)) {
    return true;
  }

  if (/^[\d\s]+$/.test(lower)) {
    return true;
  }

  return false;
}

function normalizeBrandFromTaskName(
  taskName: string
): ParsedTaskParts {
  const result = extractClientAndTask(taskName);

  return {
    clientName: result.clientName,
    taskName: result.taskName,
  };
}

/**
 * Extract PDF text and convert it into structured tasks.
 */
export async function extractTasksFromPdf(
  pdfBuffer: Buffer,
  options: ParseCalendarOptions = {}
): Promise<{
  tasks: ExtractedTask[];
  rawText: string;
  detectedMonth?: number;
  detectedYear?: number;
}> {
  const pdfParse =
    (await import('pdf-parse')).default;

  const data = await pdfParse(pdfBuffer);

  const rawText = data.text || '';

  const parsed =
    parseCalendarText(
      rawText,
      options
    );

  return {
    ...parsed,
    rawText,
  };
}

/**
 * Parse calendar PDF text.
 */
export function parseCalendarText(
  text: string,
  options: ParseCalendarOptions = {}
): {
  tasks: ExtractedTask[];
  detectedMonth?: number;
  detectedYear?: number;
} {
  const currentYear =
    options.defaultYear ||
    new Date().getFullYear();

  let detectedYear =
    options.defaultYear;

  let detectedMonth =
    options.defaultMonth;

  const lines = text
    .split(/\r?\n/)
    .map(normalizeText)
    .filter(
      line =>
        line.length > 0 &&
        !/^[A-Z]$/.test(line)
    );

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // Detect year/month
  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  for (const line of lines) {
    const lower =
      line.toLowerCase();

    const yearMatch =
      line.match(
        /\b(202[0-9]|203[0-9])\b/
      );

    if (
      yearMatch &&
      !detectedYear
    ) {
      detectedYear =
        parseInt(
          yearMatch[1],
          10
        );
    }

    for (
      const [
        monthKey,
        monthNum,
      ] of Object.entries(
        MONTH_NAMES
      )
    ) {
      const regex =
        new RegExp(
          `\\b${monthKey}\\b`,
          'i'
        );

      if (
        regex.test(lower) &&
        !detectedMonth
      ) {
        detectedMonth =
          monthNum;
      }
    }
  }

  const finalYear =
    detectedYear ||
    currentYear;

  const finalMonth =
    detectedMonth ||
    new Date().getMonth() + 1;

  const tasksMap =
    new Map<
      string,
      ExtractedTask
    >();

  // Current client section while reading sequential calendar text.
  let currentClientName:
    | string
    | undefined;

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // Add task
  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  const addTask = (
    day: number,
    rawTaskName: string,
    monthVal = finalMonth,
    yearVal = finalYear,
    explicitClientName?: string
  ) => {
    if (
      day < 1 ||
      day > 31
    ) {
      return;
    }

    const parsed =
      extractClientAndTask(
        rawTaskName,
        explicitClientName ||
          currentClientName
      );

    const cleanTaskName =
      sanitizeTaskName(
        parsed.taskName
      );

    if (
      !cleanTaskName ||
      cleanTaskName.length < 2 ||
      isNoiseLine(cleanTaskName) ||
      /^[\d\s]+$/.test(
        cleanTaskName
      )
    ) {
      return;
    }

    const clientName =
      parsed.clientName ||
      (isValidClientName(
        explicitClientName
      )
        ? cleanClientName(
            explicitClientName!
          )
        : isValidClientName(
              currentClientName
            )
          ? cleanClientName(
              currentClientName!
            )
          : undefined);

    const dateKey =
      `${yearVal}-${String(monthVal).padStart(
        2,
        '0'
      )}-${String(day).padStart(
        2,
        '0'
      )}`;

    const mapKey =
      `${dateKey}|${(clientName || '').toLowerCase()}|${cleanTaskName.toLowerCase()}`;

    if (
      !tasksMap.has(mapKey)
    ) {
      tasksMap.set(
        mapKey,
        {
          task_name:
            cleanTaskName,

          client_name:
            clientName,

          task_date:
            dateKey,

          reminder_date:
            calculateReminderDate(
              dateKey
            ),

          reminder_time:
            options.defaultReminderTime ||
            DEFAULT_REMINDER_TIME,

          recipient_phone:
            options.defaultRecipientPhone ||
            '+917025219962',

          month:
            monthVal,

          year:
            yearVal,

          approved:
            true,
        }
      );
    }
  };

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // PASS 1 Ã¢â‚¬â€ Explicit date Ã¢â€ â€™ task
  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  for (
    let i = 0;
    i < lines.length;
    i++
  ) {
    const line =
      lines[i];

    if (
      isNoiseLine(line)
    ) {
      continue;
    }

    /*
     * Example:
     * 20 August Ã¢â‚¬â€œ Scripted Ã¢â‚¬â€œ Reel 4
     */
    const m1 =
      line.match(
        /^(?:(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)(?:\s+(\d{4}))?)\s*(?:[-Ã¢â‚¬â€œÃ¢â‚¬â€:Ã¢â€ â€™>]+|\s+to\s+|\s+)\s*(.+)$/i
      );

    if (
      m1 &&
      MONTH_NAMES[
        m1[2].toLowerCase()
      ]
    ) {
      const day =
        parseInt(
          m1[1],
          10
        );

      const monthVal =
        MONTH_NAMES[
          m1[2].toLowerCase()
        ];

      const yearVal =
        m1[3]
          ? parseInt(
              m1[3],
              10
            )
          : finalYear;

      addTask(
        day,
        m1[4],
        monthVal,
        yearVal
      );

      continue;
    }

    /*
     * Example:
     * August 20 Ã¢â‚¬â€œ Disceno Ã¢â‚¬â€œ Reel 4
     */
    const m2 =
      line.match(
        /^([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\s*(?:[-Ã¢â‚¬â€œÃ¢â‚¬â€:Ã¢â€ â€™>]+|\s+)\s*(.+)$/i
      );

    if (
      m2 &&
      MONTH_NAMES[
        m2[1].toLowerCase()
      ]
    ) {
      const monthVal =
        MONTH_NAMES[
          m2[1].toLowerCase()
        ];

      const day =
        parseInt(
          m2[2],
          10
        );

      const yearVal =
        m2[3]
          ? parseInt(
              m2[3],
              10
            )
          : finalYear;

      addTask(
        day,
        m2[4],
        monthVal,
        yearVal
      );

      continue;
    }

    /*
     * Example:
     * 20 Ã¢â‚¬â€œ Scripted Ã¢â‚¬â€œ Reel 4
     */
    const m3 =
      line.match(
        /^(\d{1,2})(?:st|nd|rd|th)?\s*[-Ã¢â‚¬â€œÃ¢â‚¬â€:Ã¢â€ â€™>]\s*(.+)$/i
      );

    if (m3) {
      addTask(
        parseInt(
          m3[1],
          10
        ),
        m3[2]
      );

      continue;
    }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // PASS 2 Ã¢â‚¬â€ Sequential calendar grid
  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  let currentActiveDays:
    number[] = [];

  let pendingTaskLines:
    PendingTaskLine[] = [];

  const flushPending = () => {
    if (
      currentActiveDays.length === 0 ||
      pendingTaskLines.length === 0
    ) {
      pendingTaskLines = [];
      return;
    }

    const combinedText =
      pendingTaskLines
        .map(item => item.text)
        .join(' ')
        .trim();

    const lineClient =
      pendingTaskLines.find(
        item =>
          item.clientName
      )?.clientName;

    for (const day of currentActiveDays) {
      addTask(day, combinedText, finalMonth, finalYear, lineClient);
    }

    pendingTaskLines = [];
  };

  for (
    let i = 0;
    i < lines.length;
    i++
  ) {
    const line =
      lines[i];

    // Explicit client heading
    if (
      looksLikeClientHeader(
        line
      )
    ) {
      const cleaned =
        cleanClientName(
          line
        );

      /*
       * Only update current client if this line
       * is not itself an obvious date/task line.
       */
      if (
        !/^\d{1,2}\s*[-Ã¢â‚¬â€œÃ¢â‚¬â€:Ã¢â€ â€™>]/.test(
          line
        ) &&
        !/^[a-zA-Z]+\s+\d{1,2}/.test(
          line
        )
      ) {
        currentClientName =
          cleaned;

        continue;
      }
    }

    if (
      isNoiseLine(line) &&
      !/^\d+(\s+\d+)*$/.test(
        line
      )
    ) {
      continue;
    }

    // Day number series
    const numberSeriesMatch =
      line.match(
        /^(\d{1,2}(?:\s+\d{1,2})*)$/
      );

    if (
      numberSeriesMatch
    ) {
      flushPending();

      const days =
        numberSeriesMatch[1]
          .split(/\s+/)
          .map(n =>
            parseInt(
              n,
              10
            )
          )
          .filter(
            n =>
              n >= 1 &&
              n <= 31
          );

      currentActiveDays =
        days;

      continue;
    }

    if (
      currentActiveDays.length > 0 &&
      !isNoiseLine(line)
    ) {
      const parsed =
        extractClientAndTask(
          line,
          currentClientName
        );

      pendingTaskLines.push(
        {
          text:
            parsed.taskName,
          clientName:
            parsed.clientName,
        }
      );
    }
  }

  flushPending();

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // PASS 3 Ã¢â‚¬â€ Inline entries
  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  for (
    const line of lines
  ) {
    if (
      isNoiseLine(line)
    ) {
      continue;
    }

    /*
     * Example:
     * 20 Scripted Ã¢â‚¬â€œ Reel 4
     */
    const inlineMatch =
      line.match(
        /^(\d{1,2})(?:st|nd|rd|th)?\s+(.{2,})$/i
      );

    if (
      inlineMatch
    ) {
      const day =
        parseInt(
          inlineMatch[1],
          10
        );

      const potentialTask =
        inlineMatch[2].trim();

      if (
        !MONTH_NAMES[
          potentialTask.toLowerCase()
        ]
      ) {
        addTask(
          day,
          potentialTask
        );
      }
    }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // Final cleanup
  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

  const tasks =
    Array.from(
      tasksMap.values()
    ).sort(
      (a, b) =>
        a.task_date.localeCompare(
          b.task_date
        )
    );

  return {
    tasks,

    detectedMonth:
      finalMonth,

    detectedYear:
      finalYear,
  };
}
