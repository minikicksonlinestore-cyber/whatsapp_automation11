import { NextRequest, NextResponse } from 'next/server';
import { sendTestWhatsAppMessage } from '@/lib/whatsapp';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const recipient = body.recipient_phone || '+917025219962';
    const templateName = body.template_name;

    const result = await sendTestWhatsAppMessage(recipient, templateName);

    // Record test in whatsapp_logs
    try {
      await supabaseAdmin.from('whatsapp_logs').insert({
        recipient_phone: recipient,
        message_type: 'test_template',
        whatsapp_message_id: result.messageId || null,
        status: result.success ? 'success' : 'failed',
        response: result.rawResponse || null,
        error: result.error || null,
      });
    } catch (logErr) {
      console.warn('Could not record test in whatsapp_logs:', logErr);
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        recipient,
        details: 'Test WhatsApp message sent successfully via Meta Cloud API.',
        metaResponse: result.rawResponse,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          metaResponse: result.rawResponse,
        },
        { status: 400 }
      );
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
