import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { normalizePhoneNumber, normalizeTimeString } from '@/lib/date/calculator';
import { env } from '@/lib/validation/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Supabase settings query error:', error);
    }

    const defaultSettings = {
      business_phone: '+919061082040',
      recipient_phone: '+917025219962',
      reminder_time: '18:00:00',
      timezone: 'Asia/Kolkata',
      whatsapp_template_name: env.WHATSAPP_TEMPLATE_NAME || 'task_reminder',
      message_template: `🔔 Task Reminder

Tomorrow ({{date}}) you have:
📌 {{task}}

Please complete the task on time.`,
    };

    return NextResponse.json({
      settings: settings || defaultSettings,
      envConfig: {
        isTokenConfigured: Boolean(env.WHATSAPP_ACCESS_TOKEN),
        isPhoneIdConfigured: Boolean(env.WHATSAPP_PHONE_NUMBER_ID),
        apiVersion: env.WHATSAPP_API_VERSION,
        isCronSecretConfigured: Boolean(env.CRON_SECRET),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { business_phone, recipient_phone, reminder_time, timezone, whatsapp_template_name, message_template } = body;

    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (business_phone) payload.business_phone = normalizePhoneNumber(business_phone);
    if (recipient_phone) payload.recipient_phone = normalizePhoneNumber(recipient_phone);
    if (reminder_time) payload.reminder_time = normalizeTimeString(reminder_time);
    if (timezone) payload.timezone = timezone;
    if (whatsapp_template_name) payload.whatsapp_template_name = whatsapp_template_name;
    if (message_template) payload.message_template = message_template;

    // Check if settings record exists
    const { data: existing } = await supabaseAdmin.from('settings').select('id').limit(1).maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('settings')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('settings')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return NextResponse.json({ success: true, settings: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
