import { NextRequest, NextResponse } from 'next/server';
import { extractTasksFromPdf } from '@/lib/pdf/extractor';
import { supabaseAdmin } from '@/lib/supabase/admin';

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

    // Save record to pdf_files table if Supabase is connected
    let pdfRecordId: string | null = null;
    try {
      const { data: pdfRecord } = await supabaseAdmin
        .from('pdf_files')
        .insert({
          filename: file.name,
          storage_path: `uploads/${Date.now()}_${file.name}`,
          file_size: file.size,
          processing_status: 'processing',
        })
        .select()
        .single();

      if (pdfRecord) {
        pdfRecordId = pdfRecord.id;
      }
    } catch (dbErr) {
      console.warn('Supabase DB notice during pdf_files insert:', dbErr);
    }

    const extractionResult = await extractTasksFromPdf(buffer, {
      defaultYear,
      defaultMonth,
      defaultRecipientPhone,
      defaultReminderTime,
    });

    if (pdfRecordId) {
      try {
        await supabaseAdmin
          .from('pdf_files')
          .update({
            processing_status: 'processed',
          })
          .eq('id', pdfRecordId);
      } catch (err) {
        console.warn('Supabase status update notice:', err);
      }
    }

    return NextResponse.json({
      success: true,
      pdfId: pdfRecordId,
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
