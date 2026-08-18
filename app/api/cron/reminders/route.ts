import { NextRequest, NextResponse } from 'next/server';
import { getTasksFromStore, updateTaskStatus, logWhatsAppMessage } from '@/lib/storage/store';
import { sendBaileysGroupReminder, sendBaileysIndividual, formatGroupDateLabel, buildGroupMessageText, getBaileysStatus } from '@/lib/whatsapp-baileys';
import { getNowInTimezone } from '@/lib/date/calculator';
import { env } from '@/lib/validation/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecretQuery = req.nextUrl.searchParams.get('secret');

  if (env.CRON_SECRET) {
    const isAuthorizedHeader = authHeader === `Bearer ${env.CRON_SECRET}`;
    const isAuthorizedQuery = cronSecretQuery === env.CRON_SECRET;
    if (!isAuthorizedHeader && !isAuthorizedQuery) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or missing CRON_SECRET authorization.' }, { status: 401 });
    }
  }

  try {
    const timezone = process.env.TIMEZONE || 'Asia/Kolkata';
    const { currentDate, currentTime, formattedDisplay } = getNowInTimezone(timezone);

    console.log(`[Cron Reminders] Executing at ${formattedDisplay} (${timezone})`);

    // ── 1. Check Baileys gateway status ─────────────────────────────────────
    const gatewayStatus = await getBaileysStatus();
    if (!gatewayStatus.connected) {
      const msg = `Baileys gateway not connected. ${gatewayStatus.error || 'Start: node baileys/gateway.mjs'}`;
      console.error('[Cron Reminders]', msg);
      return NextResponse.json({ error: msg, evaluatedAt: formattedDisplay }, { status: 503 });
    }

    console.log(`[Cron Reminders] Gateway connected as ${gatewayStatus.phone}`);

    // ── 2. Fetch pending tasks due now ───────────────────────────────────────
    const { tasks: allPending } = await getTasksFromStore({ status: 'pending' });

    const dueTasks = allPending.filter(t =>
      t.reminder_date <= currentDate && t.reminder_time <= currentTime
    );

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

    // ── 3. Group tasks by reminder_date ──────────────────────────────────────
    //  Format: { "2026-08-19": [ task, task, ... ] }
    const byDate: Record<string, typeof dueTasks> = {};
    for (const task of dueTasks) {
      const key = task.reminder_date || task.task_date;
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(task);
    }

    // ── 4. Resolve group ID ──────────────────────────────────────────────────
    const groupId = process.env.WHATSAPP_GROUP_ID || '';

    const results: any[] = [];

    // ── 5. Send grouped messages, one per date ───────────────────────────────
    for (const [taskDate, tasks] of Object.entries(byDate)) {
      const dateLabel = formatGroupDateLabel(taskDate);

      // Build items from task_name — expected format: "ClientName – TaskName"
      // If task_name has " – " separator use it; otherwise use task_name as-is
      const items = tasks.map(t => {
        const sep = t.task_name.includes(' – ') ? ' – ' : (t.task_name.includes(' - ') ? ' - ' : null);
        if (sep) {
          const [client, ...rest] = t.task_name.split(sep);
          return { client: client.trim(), task: rest.join(sep).trim() };
        }
        return { client: 'Task', task: t.task_name.trim() };
      });

      let sendResult: { success: boolean; messageId?: string; error?: string };

      if (groupId) {
        // ── Send to group ────────────────────────────────────────────────────
        console.log(`[Cron Reminders] Sending group message for ${dateLabel} → ${groupId}`);
        sendResult = await sendBaileysGroupReminder({ groupId, dateLabel, items });
      } else {
        // ── Fallback: send individual messages to each task's recipient ──────
        console.warn('[Cron Reminders] WHATSAPP_GROUP_ID not set — falling back to individual messages.');
        const message = buildGroupMessageText(dateLabel, items);
        const recipient = tasks[0]?.recipient_phone || '+917025219962';
        sendResult = await sendBaileysIndividual({ phone: recipient, message });
      }

      // ── 6. Update all tasks in this date group ───────────────────────────
      for (const task of tasks) {
        if (sendResult.success) {
          await updateTaskStatus(task.id, 'sent', {
            whatsapp_message_id: sendResult.messageId,
            sent_at: new Date().toISOString(),
          });
        } else {
          await updateTaskStatus(task.id, 'failed', {
            error_message: sendResult.error || 'Send failed',
          });
        }

        await logWhatsAppMessage({
          task_id: task.id,
          recipient_phone: groupId || task.recipient_phone,
          message_type: groupId ? 'group' : 'individual',
          whatsapp_message_id: sendResult.messageId || null,
          status: sendResult.success ? 'success' : 'failed',
          error: sendResult.error || null,
        } as any);

        results.push({
          taskId: task.id,
          taskName: task.task_name,
          taskDate: task.task_date,
          dateLabel,
          status: sendResult.success ? 'sent' : 'failed',
          messageId: sendResult.messageId,
          error: sendResult.error,
        });
      }
    }

    return NextResponse.json({
      success: true,
      evaluatedAt: formattedDisplay,
      currentDate,
      currentTime,
      processedCount: results.length,
      sentCount: results.filter(r => r.status === 'sent').length,
      failedCount: results.filter(r => r.status === 'failed').length,
      groupId: groupId || null,
      results,
    });
  } catch (err: any) {
    console.error('[Cron Reminders] Unhandled error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
