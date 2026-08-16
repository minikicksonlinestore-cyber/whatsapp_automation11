import { NextRequest, NextResponse } from 'next/server';
import { saveApprovedTasks } from '@/lib/storage/store';
import { ExtractedTask } from '@/lib/types/database';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tasks, pdfId } = body as { tasks: ExtractedTask[]; pdfId?: string };

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: 'No tasks provided for approval.' }, { status: 400 });
    }

    const result = await saveApprovedTasks(tasks, pdfId);

    return NextResponse.json({
      success: true,
      count: result.count,
      tasks: result.tasks,
    });
  } catch (err: any) {
    console.error('Failed to approve tasks:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

