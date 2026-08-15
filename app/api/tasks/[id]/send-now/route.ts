import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendWhatsAppReminder } from '@/lib/whatsapp';
import { formatReadableDate } from '@/lib/date/calculator';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const taskId = params.id;

    // Fetch the task
    const { data: task, error: fetchErr } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchErr || !task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    const taskDateFormatted = formatReadableDate(task.task_date);

    // Send WhatsApp reminder
    const sendResult = await sendWhatsAppReminder({
      to: task.recipient_phone,
      taskDateFormatted,
      taskName: task.task_name,
    });

    // Save log to whatsapp_logs table
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
      const { data: updatedTask } = await supabaseAdmin
        .from('tasks')
        .update({
          status: 'sent',
          whatsapp_message_id: sendResult.messageId,
          sent_at: new Date().toISOString(),
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id)
        .select()
        .single();

      return NextResponse.json({
        success: true,
        messageId: sendResult.messageId,
        task: updatedTask,
      });
    } else {
      await supabaseAdmin
        .from('tasks')
        .update({
          status: 'failed',
          error_message: sendResult.error,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      return NextResponse.json(
        {
          success: false,
          error: sendResult.error,
        },
        { status: 400 }
      );
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
