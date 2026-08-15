import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppReminder } from '@/lib/whatsapp';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatReadableDate } from '@/lib/date/calculator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, task_name, task_date, template_name } = body;

    if (!to || !task_name || !task_date) {
      return NextResponse.json(
        { error: 'Fields "to", "task_name", and "task_date" are required.' },
        { status: 400 }
      );
    }

    const taskDateFormatted = formatReadableDate(task_date);

    const result = await sendWhatsAppReminder({
      to,
      taskName: task_name,
      taskDateFormatted,
      templateName: template_name,
    });

    try {
      await supabaseAdmin.from('whatsapp_logs').insert({
        recipient_phone: to,
        message_type: 'template',
        whatsapp_message_id: result.messageId || null,
        status: result.success ? 'success' : 'failed',
        response: result.rawResponse || null,
        error: result.error || null,
      });
    } catch (logErr) {
      console.warn('Could not insert whatsapp_logs:', logErr);
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
