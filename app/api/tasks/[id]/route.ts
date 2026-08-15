import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { calculateReminderDate, normalizeTimeString, normalizePhoneNumber } from '@/lib/date/calculator';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const taskId = params.id;
    const body = await req.json();

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.task_name !== undefined) updateData.task_name = body.task_name.trim();
    if (body.task_date !== undefined) {
      updateData.task_date = body.task_date;
      updateData.reminder_date = calculateReminderDate(body.task_date);
    }
    if (body.reminder_time !== undefined) updateData.reminder_time = normalizeTimeString(body.reminder_time);
    if (body.recipient_phone !== undefined) updateData.recipient_phone = normalizePhoneNumber(body.recipient_phone);
    if (body.status !== undefined) updateData.status = body.status;

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, task: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const taskId = params.id;
    const { error } = await supabaseAdmin.from('tasks').delete().eq('id', taskId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
