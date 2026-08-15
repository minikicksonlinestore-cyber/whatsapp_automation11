import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { calculateReminderDate, normalizeTimeString, normalizePhoneNumber } from '@/lib/date/calculator';
import { ExtractedTask } from '@/lib/types/database';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tasks, pdfId } = body as { tasks: ExtractedTask[]; pdfId?: string };

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: 'No tasks provided for approval.' }, { status: 400 });
    }

    const preparedTasks = tasks.map(t => {
      const taskDate = t.task_date;
      const reminderDate = t.reminder_date || calculateReminderDate(taskDate);
      const reminderTime = normalizeTimeString(t.reminder_time || '18:00:00');
      const recipientPhone = normalizePhoneNumber(t.recipient_phone || '+917025219962');

      return {
        pdf_id: pdfId || null,
        task_name: t.task_name.trim(),
        task_date: taskDate,
        reminder_date: reminderDate,
        reminder_time: reminderTime,
        recipient_phone: recipientPhone,
        status: 'pending',
        updated_at: new Date().toISOString(),
      };
    });

    // Upsert tasks into Supabase table with unique idempotency on (recipient_phone, task_date, task_name)
    const { data, error } = await supabaseAdmin
      .from('tasks')
      .upsert(preparedTasks, {
        onConflict: 'recipient_phone,task_date,task_name',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error('Database error approving tasks:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: data?.length || preparedTasks.length,
      tasks: data,
    });
  } catch (err: any) {
    console.error('Failed to approve tasks:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
