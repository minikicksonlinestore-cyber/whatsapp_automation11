import { NextRequest, NextResponse } from 'next/server';
import { getTasksFromStore, saveApprovedTasks } from '@/lib/storage/store';
import { calculateReminderDate, normalizeTimeString, normalizePhoneNumber } from '@/lib/date/calculator';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const { tasks, total } = await getTasksFromStore({
      status,
      search,
      fromDate,
      toDate,
      limit,
      offset,
    });

    return NextResponse.json({
      tasks,
      total,
      limit,
      offset,
    });
  } catch (err: any) {
    console.error('Error in GET /api/tasks:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { task_name, task_date, reminder_time, recipient_phone } = body;

    if (!task_name || !task_date) {
      return NextResponse.json({ error: 'task_name and task_date are required.' }, { status: 400 });
    }

    const reminder_date = calculateReminderDate(task_date);
    const normalizedTime = normalizeTimeString(reminder_time || '18:00:00');
    const normalizedPhone = normalizePhoneNumber(recipient_phone || '+917025219962');

    const result = await saveApprovedTasks([{
      task_name: task_name.trim(),
      task_date,
      reminder_date,
      reminder_time: normalizedTime,
      recipient_phone: normalizedPhone,
      month: parseInt(task_date.split('-')[1], 10),
      year: parseInt(task_date.split('-')[0], 10),
      approved: true,
    }]);

    return NextResponse.json({ success: true, task: result.tasks[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

