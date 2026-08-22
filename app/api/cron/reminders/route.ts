import { NextRequest, NextResponse } from 'next/server';
import { getTasksFromStore, updateTaskStatus, logWhatsAppMessage } from '@/lib/storage/store';
import {
  sendWhatsAppGroupMessage,
  formatGroupDateLabel,
  buildGroupMessage,
} from '@/lib/sendWhatsAppGroupMessage';
import { getSettingsStore } from '@/lib/storage/store';
import { getNowInTimezone } from '@/lib/date/calculator';
import { env } from '@/lib/validation/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  const cronSecretQuery = req.nextUrl.searchParams.get('secret');

  if (env.CRON_SECRET) {
    const isAuthorizedHeader = authHeader === `Bearer ${env.CRON_SECRET}`;
    const isAuthorizedQuery = cronSecretQuery === env.CRON_SECRET;
    if (!isAuthorizedHeader && !isAuthorizedQuery) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing CRON_SECRET.' },
        { status: 401 }
      );
    }
  }

  try {
    // ── 1. Load settings ─────────────────────────────────────────────────────
    const settings = await getSettingsStore();
    const timezone = settings.timezone || process.env.TIMEZONE || 'Asia/Kolkata';
    const { currentDate, currentTime, formattedDisplay } = getNowInTimezone(timezone);

    console.log(`[Cron Reminders] Running at ${formattedDisplay} (${timezone})`);

    // ── 2. Load saved group ID from settings ─────────────────────────────────
    const groupId = settings.whatsapp_group_id || process.env.WHATSAPP_GROUP_ID || '';
    if (!groupId) {
      const msg = 'No WhatsApp group configured. Set WHATSAPP_GROUP_ID in env or select a group in Settings.';
      console.error('[Cron Reminders]', msg);
      return NextResponse.json({ error: msg, evaluatedAt: formattedDisplay }, { status: 400 });
    }

    // ── 3. Find pending tasks due now ────────────────────────────────────────
    const { tasks: allPending } = await getTasksFromStore({ status: 'pending', limit: 1000 });
    
    // Parse time to minutes-since-midnight for robust comparison
    const timeToMinutes = (tStr: string): number => {
      const [h, m] = tStr.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    
    const currentMinutes = timeToMinutes(currentTime);
    const graceBufferMinutes = 15; // Allow tasks scheduled up to 15 minutes in the future to trigger
    
    const dueTasks = allPending.filter(t => {
      if (!t.reminder_date) return false;
      if (t.reminder_date < currentDate) {
        return true; // Missed from past days
      }
      if (t.reminder_date === currentDate) {
        const taskMinutes = timeToMinutes(t.reminder_time || '18:00:00');
        return taskMinutes <= currentMinutes + graceBufferMinutes;
      }
      return false;
    });

    if (dueTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No reminders due at this time.',
        evaluatedAt: formattedDisplay,
        currentDate,
        currentTime,
        processedCount: 0,
      });
    }

    console.log(`[Cron Reminders] Found ${dueTasks.length} task(s) due.`);

    // ── 4. Group tasks by task_date ──────────────────────────────────────────
    const byDate: Record<string, typeof dueTasks> = {};
    for (const task of dueTasks) {
      const key = task.task_date;
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(task);
    }

    const results: any[] = [];

    // ── 5. Send one grouped message per date ─────────────────────────────────
    for (const [taskDate, tasks] of Object.entries(byDate)) {
      const dateLabel = formatGroupDateLabel(taskDate);

      // Parse task_name: if it contains " – " treat left as client, right as task
      // Otherwise use task_name as-is in the task column
      const items = tasks.map(t => {
        const sep = t.task_name.includes(' – ')
          ? ' – '
          : t.task_name.includes(' - ')
          ? ' - '
          : null;
        if (sep) {
          const idx = t.task_name.indexOf(sep);
          return {
            client: t.task_name.substring(0, idx).trim(),
            task: t.task_name.substring(idx + sep.length).trim(),
          };
        }
        return { client: '', task: t.task_name.trim() };
      });

      // Filter out items with no client (use task name directly)
      const messageItems = items.map(i =>
        i.client ? i : { client: 'Reminder', task: i.task }
      );

      const message = buildGroupMessage(dateLabel, messageItems);

      console.log(`[Cron Reminders] Sending group message for ${dateLabel} → ${groupId}`);

      // ── Use shared sender (same as "Send Now") ────────────────────────────
      const sendResult = await sendWhatsAppGroupMessage({ groupId, message });

      // ── Update status for every task in this date group ───────────────────
      for (const task of tasks) {
        if (sendResult.success) {
          await updateTaskStatus(task.id, 'sent', {
            whatsapp_message_id: sendResult.messageId,
            sent_at: new Date().toISOString(),
          });
        } else {
          await updateTaskStatus(task.id, 'failed', {
            error_message: sendResult.error || 'Group send failed',
          });
        }

        // Log every attempt
        try {
          await logWhatsAppMessage({
            task_id: task.id,
            recipient_phone: groupId,
            message_type: 'group',
            whatsapp_message_id: sendResult.messageId || null,
            status: sendResult.success ? 'success' : 'failed',
            error: sendResult.error || null,
          } as any);
        } catch (logErr) {
          console.warn('[Cron Reminders] Log write failed:', logErr);
        }

        results.push({
          taskId: task.id,
          taskName: task.task_name,
          taskDate: task.task_date,
          dateLabel,
          status: sendResult.success ? 'sent' : 'failed',
          messageId: sendResult.messageId || null,
          error: sendResult.error || null,
        });
      }

      // Log per-date result
      if (sendResult.success) {
        console.log(`[Cron Reminders] ✅ ${dateLabel} → messageId=${sendResult.messageId}`);
      } else {
        console.error(`[Cron Reminders] ❌ ${dateLabel} → error=${sendResult.error}`);
      }
    }

    return NextResponse.json({
      success: true,
      evaluatedAt: formattedDisplay,
      currentDate,
      currentTime,
      groupId,
      processedCount: results.length,
      sentCount: results.filter(r => r.status === 'sent').length,
      failedCount: results.filter(r => r.status === 'failed').length,
      results,
    });
  } catch (err: any) {
    console.error('[Cron Reminders] Unhandled error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
