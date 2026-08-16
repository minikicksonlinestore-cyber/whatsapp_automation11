import { NextRequest, NextResponse } from 'next/server';
import { updateTaskInStore, deleteTaskFromStore } from '@/lib/storage/store';
import { calculateReminderDate, normalizeTimeString, normalizePhoneNumber } from '@/lib/date/calculator';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const taskId = params.id;
    const body = await req.json();

    const updateData: any = {};
    if (body.task_name !== undefined) updateData.task_name = body.task_name.trim();
    if (body.task_date !== undefined) {
      updateData.task_date = body.task_date;
      updateData.reminder_date = calculateReminderDate(body.task_date);
    }
    if (body.reminder_time !== undefined) updateData.reminder_time = normalizeTimeString(body.reminder_time);
    if (body.recipient_phone !== undefined) updateData.recipient_phone = normalizePhoneNumber(body.recipient_phone);
    if (body.status !== undefined) updateData.status = body.status;

    const updated = await updateTaskInStore(taskId, updateData);
    return NextResponse.json({ success: true, task: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const taskId = params.id;
    await deleteTaskFromStore(taskId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

