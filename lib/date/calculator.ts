import { format, subDays, parseISO, isValid } from 'date-fns';
import { toZonedTime, format as formatTz } from 'date-fns-tz';

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
export const DEFAULT_REMINDER_TIME = '18:00:00';

/**
 * Calculates the reminder date as exactly 1 day before the task date.
 * @param taskDate ISO date string YYYY-MM-DD or Date object
 * @returns ISO date string YYYY-MM-DD for the reminder
 */
export function calculateReminderDate(taskDate: string | Date): string {
  let dateObj: Date;
  if (typeof taskDate === 'string') {
    dateObj = parseISO(taskDate);
  } else {
    dateObj = taskDate;
  }

  if (!isValid(dateObj)) {
    throw new Error(`Invalid date supplied for reminder calculation: ${taskDate}`);
  }

  const reminderDateObj = subDays(dateObj, 1);
  return format(reminderDateObj, 'yyyy-MM-dd');
}

/**
 * Formats a date string (YYYY-MM-DD) into a human readable format for WhatsApp templates.
 * E.g., '2026-08-20' -> '20 August 2026'
 */
export function formatReadableDate(dateString: string): string {
  const dateObj = parseISO(dateString);
  if (!isValid(dateObj)) {
    return dateString;
  }
  return format(dateObj, 'd MMMM yyyy');
}

/**
 * Gets current date and time formatted in the given timezone.
 */
export function getNowInTimezone(timezone: string = DEFAULT_TIMEZONE) {
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  const currentDate = formatTz(zonedNow, 'yyyy-MM-dd', { timeZone: timezone });
  const currentTime = formatTz(zonedNow, 'HH:mm:ss', { timeZone: timezone });

  return {
    now,
    zonedNow,
    currentDate,
    currentTime,
    formattedDisplay: formatTz(zonedNow, 'dd MMM yyyy, hh:mm:ss a zzz', { timeZone: timezone }),
  };
}

/**
 * Normalizes time string to HH:mm:ss
 */
export function normalizeTimeString(timeStr: string): string {
  if (!timeStr) return DEFAULT_REMINDER_TIME;
  const parts = timeStr.trim().split(':');
  const hours = parts[0]?.padStart(2, '0') || '18';
  const minutes = parts[1]?.padStart(2, '0') || '00';
  const seconds = parts[2]?.padStart(2, '0') || '00';
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Normalizes phone numbers to international standard with leading '+' (e.g. +917025219962)
 */
export function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  return `+${cleaned}`;
}

/**
 * Strips '+' for WhatsApp Meta API payload if needed (Meta requires country code without '+')
 */
export function formatPhoneForWhatsApp(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}
