import { NextRequest, NextResponse } from 'next/server';
import { extractTasksFromPdf } from '@/lib/pdf/extractor';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const defaultYear = formData.get('defaultYear') ? parseInt(formData.get('defaultYear') as string, 10) : undefined;
    const defaultMonth = formData.get('defaultMonth') ? parseInt(formData.get('defaultMonth') as string, 10) : undefined;
    const defaultRecipientPhone = (formData.get('defaultRecipientPhone') as string) || '+917025219962';
    const defaultReminderTime = (formData.get('defaultReminderTime') as string) || '18:00:00';

    if (!file) {
      return NextResponse.json({ error: 'No PDF file provided in request.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Uploaded file must be a PDF document.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const extractionResult = await extractTasksFromPdf(buffer, {
      defaultYear,
      defaultMonth,
      defaultRecipientPhone,
      defaultReminderTime,
    });

    return NextResponse.json({
      success: true,
      filename: file.name,
      tasks: extractionResult.tasks,
      detectedMonth: extractionResult.detectedMonth,
      detectedYear: extractionResult.detectedYear,
      rawTextSummary: extractionResult.rawText.substring(0, 500),
      totalExtracted: extractionResult.tasks.length,
    });
  } catch (error: any) {
    console.error('PDF extraction failed:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to extract tasks from PDF calendar.',
      },
      { status: 500 }
    );
  }
}
