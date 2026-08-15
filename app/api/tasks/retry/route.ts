import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendWhatsAppReminder } from '@/lib/whatsapp';
import { formatReadableDate } from '@/lib/date/calculator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { taskIds } = body as { taskIds?: string[] };

    let query = supabaseAdmin.from('tasks').select('*').eq('status', 'failed');

    if (taskIds && taskIds.length > 0) {
      query = query.in('id', taskIds);
    }

    const { data: failedTasks, error } = await query;

    if (error || !failedTasks) {
      return NextResponse.json({ error: error?.message || 'Failed to query failed tasks' }, { status: 500 });
    }

    const results = [];

    for (const task of failedTasks) {
      const taskDateFormatted = formatReadableDate(task.task_date);
      const sendResult = await sendWhatsAppReminder({
        to: task.recipient_phone,
        taskDateFormatted,
        taskName: task.task_name,
      });

      await supabaseAdmin.from('whatsapp_logs').insert({
        task_id: task.id,
        recipient_phone: task.recipient_phone,
        message_type: 'template',
        whatsapp_message_id: sendResult.messageId || null,
        status: sendResult.success ? 'success' : 'failed',
        response: sendResult.rawResponse || null,
        error: sendResult.error || null,
      });

      if (sendResult.success) {
        await supabaseAdmin
          .from('tasks')
          .update({
            status: 'sent',
            whatsapp_message_id: sendResult.messageId,
            sent_at: new Date().toISOString(),
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', task.id);

        results.push({ id: task.id, success: true, messageId: sendResult.messageId });
      } else {
        await supabaseAdmin
          .from('tasks')
          .update({
            error_message: sendResult.error,
            updated_at: new Date().toISOString(),
          })
          .eq('id', task.id);

        results.push({ id: task.id, success: false, error: sendResult.error });
      }
    }

    return NextResponse.json({
      totalRetried: failedTasks.length,
      successCount: results.filter(r => r.success).length,
      failedCount: results.filter(r => !r.success).length,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
