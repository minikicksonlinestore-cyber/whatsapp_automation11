import { NextRequest, NextResponse } from 'next/server';
import { getTasksFromStore, updateTaskStatus, logWhatsAppMessage } from '@/lib/storage/store';
import { getSettingsStore } from '@/lib/storage/store';
import { sendWhatsAppGroupMessage, formatGroupDateLabel, buildGroupMessage } from '@/lib/sendWhatsAppGroupMessage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { taskIds } = body as { taskIds?: string[] };

    // Use unified store (same as task list) to find failed tasks
    const { tasks: allTasks } = await getTasksFromStore({ status: 'failed', limit: 200 });

    const failedTasks = taskIds && taskIds.length > 0
      ? allTasks.filter(t => taskIds.includes(t.id))
      : allTasks;

    if (failedTasks.length === 0) {
      return NextResponse.json({ totalRetried: 0, successCount: 0, failedCount: 0, results: [] });
    }

    // Load group ID from settings
    const settings = await getSettingsStore();
    const groupId = settings.whatsapp_group_id || process.env.WHATSAPP_GROUP_ID || '';

    if (!groupId) {
      return NextResponse.json({
        error: 'No WhatsApp group configured. Go to Settings and select a group.',
      }, { status: 400 });
    }

    const results = [];

    for (const task of failedTasks) {
      const dateLabel = formatGroupDateLabel(task.task_date);

      const sep = task.task_name.includes(' – ')
        ? ' – '
        : task.task_name.includes(' - ')
        ? ' - '
        : null;

      let items: Array<{ client: string; task: string }>;
      if (sep) {
        const idx = task.task_name.indexOf(sep);
        items = [{
          client: task.task_name.substring(0, idx).trim(),
          task: task.task_name.substring(idx + sep.length).trim(),
        }];
      } else {
        items = [{ client: 'Reminder', task: task.task_name.trim() }];
      }

      const message = buildGroupMessage(dateLabel, items);
      const sendResult = await sendWhatsAppGroupMessage({ groupId, message });

      if (sendResult.success) {
        await updateTaskStatus(task.id, 'sent', {
          whatsapp_message_id: sendResult.messageId,
          sent_at: new Date().toISOString(),
        });
      } else {
        await updateTaskStatus(task.id, 'failed', {
          error_message: sendResult.error || 'Retry send failed',
        });
      }

      try {
        await logWhatsAppMessage({
          task_id: task.id,
          recipient_phone: groupId,
          message_type: 'group_retry',
          whatsapp_message_id: sendResult.messageId || null,
          status: sendResult.success ? 'success' : 'failed',
          error: sendResult.error || null,
        } as any);
      } catch (logErr) {
        console.warn('[Retry] Log write failed:', logErr);
      }

      results.push({
        id: task.id,
        taskName: task.task_name,
        success: sendResult.success,
        messageId: sendResult.messageId || null,
        error: sendResult.error || null,
      });
    }

    return NextResponse.json({
      totalRetried: failedTasks.length,
      successCount: results.filter(r => r.success).length,
      failedCount: results.filter(r => !r.success).length,
      results,
    });
  } catch (err: any) {
    console.error('[Retry] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
