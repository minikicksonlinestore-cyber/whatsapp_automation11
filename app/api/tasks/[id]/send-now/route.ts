import { NextRequest, NextResponse } from 'next/server';
import { getTasksFromStore, updateTaskStatus, logWhatsAppMessage } from '@/lib/storage/store';
import { getSettingsStore } from '@/lib/storage/store';
import { sendWhatsAppGroupMessage, formatGroupDateLabel, buildGroupMessage } from '@/lib/sendWhatsAppGroupMessage';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tasks/[id]/send-now
 *
 * Looks up the task by id using the same unified store as everywhere else
 * (Supabase first, memory fallback second — same path as GET /api/tasks).
 * Sends to the configured WhatsApp group via the Baileys gateway.
 * Returns the real messageId on success; real error on failure.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id?.trim();

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required.' }, { status: 400 });
    }

    // ── 1. Look up task via the same unified store (Supabase → memory) ────────
    // Fetch all tasks and find by id — consistent with how the Tasks list reads
    const { tasks } = await getTasksFromStore({ limit: 1000 });
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      console.error(`[Send Now] Task not found: id="${taskId}". Available IDs:`, tasks.slice(0, 5).map(t => t.id));
      return NextResponse.json(
        { error: `Task not found (id: ${taskId}). It may have been deleted or not yet saved.` },
        { status: 404 }
      );
    }

    console.log(`[Send Now] Found task: "${task.task_name}" (${task.task_date}) id=${task.id}`);

    // ── 2. Resolve target WhatsApp group ──────────────────────────────────────
    const settings = await getSettingsStore();
    const groupId = settings.whatsapp_group_id || process.env.WHATSAPP_GROUP_ID || '';

    if (!groupId) {
      return NextResponse.json({
        error: 'No WhatsApp group configured. Go to Settings and select a group.',
      }, { status: 400 });
    }

    // ── 3. Build message ──────────────────────────────────────────────────────
    const dateLabel = formatGroupDateLabel(task.task_date);

    // Parse "ClientName – Task" format if present, otherwise use task_name as the task
    let items: Array<{ client: string; task: string }>;
    const sep = task.task_name.includes(' – ')
      ? ' – '
      : task.task_name.includes(' - ')
      ? ' - '
      : null;

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

    console.log(`[Send Now] Sending to group ${groupId}:\n${message}`);

    // ── 4. Send via shared Baileys sender ─────────────────────────────────────
    const sendResult = await sendWhatsAppGroupMessage({ groupId, message });

    // ── 5. Update task status in store ────────────────────────────────────────
    let updateSuccess = false;
    if (sendResult.success) {
      updateSuccess = await updateTaskStatus(task.id, 'sent', {
        whatsapp_message_id: sendResult.messageId,
        sent_at: new Date().toISOString(),
      });
    } else {
      await updateTaskStatus(task.id, 'failed', {
        error_message: sendResult.error || 'Send failed',
      });
    }

    // ── 6. Log the attempt ────────────────────────────────────────────────────
    try {
      await logWhatsAppMessage({
        task_id: task.id,
        recipient_phone: groupId,
        message_type: 'group_send_now',
        whatsapp_message_id: sendResult.messageId || null,
        status: sendResult.success ? 'success' : 'failed',
        error: sendResult.error || null,
      } as any);
    } catch (logErr) {
      console.warn('[Send Now] Log write failed (non-fatal):', logErr);
    }

    if (sendResult.success) {
      if (!updateSuccess) {
        console.error(`[Send Now] Failed to update task status in store/Supabase for task ${task.id}`);
        return NextResponse.json(
          { success: false, error: 'Message sent via WhatsApp, but failed to save status to database.' },
          { status: 500 }
        );
      }
      console.log(`[Send Now] ✅ messageId=${sendResult.messageId} for task "${task.task_name}"`);
      return NextResponse.json({
        success: true,
        messageId: sendResult.messageId,
        task: { ...task, status: 'sent', whatsapp_message_id: sendResult.messageId },
        groupId,
        message,
      });
    } else {
      console.error(`[Send Now] ❌ error="${sendResult.error}" for task "${task.task_name}"`);
      return NextResponse.json(
        { success: false, error: sendResult.error },
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error('[Send Now] Unhandled error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
