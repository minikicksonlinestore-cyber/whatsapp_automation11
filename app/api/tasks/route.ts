import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { calculateReminderDate, normalizeTimeString, normalizePhoneNumber } from '@/lib/date/calculator';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = supabaseAdmin
      .from('tasks')
      .select('*, pdf_file:pdf_files(filename)', { count: 'exact' })
      .order('task_date', { ascending: true })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.ilike('task_name', `%${search}%`);
    }

    if (fromDate) {
      query = query.gte('task_date', fromDate);
    }

    if (toDate) {
      query = query.lte('task_date', toDate);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching tasks from Supabase:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      tasks: data || [],
      total: count || 0,
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

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .insert({
        task_name: task_name.trim(),
        task_date,
        reminder_date,
        reminder_time: normalizedTime,
        recipient_phone: normalizedPhone,
        status: 'pending',
      })
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
