import { NextRequest, NextResponse } from 'next/server';
import { getSettingsStore, updateSettingsStore } from '@/lib/storage/store';
import { normalizePhoneNumber, normalizeTimeString } from '@/lib/date/calculator';
import { WHATSAPP_GROUPS } from '@/lib/whatsapp-groups';
import { env } from '@/lib/validation/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getSettingsStore();

    return NextResponse.json({
      settings,
      // Only expose name+id — never gateway URL or secret
      groups: WHATSAPP_GROUPS,
      envConfig: {
        isBaileysConfigured: Boolean(process.env.BAILEYS_GATEWAY_URL && process.env.BAILEYS_GATEWAY_SECRET),
        isCronSecretConfigured: Boolean(env.CRON_SECRET),
        // Legacy Meta fields kept for UI display only — not used for group sending
        isTokenConfigured: Boolean(env.WHATSAPP_ACCESS_TOKEN),
        isPhoneIdConfigured: Boolean(env.WHATSAPP_PHONE_NUMBER_ID),
        apiVersion: env.WHATSAPP_API_VERSION,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      business_phone,
      recipient_phone,
      reminder_time,
      timezone,
      whatsapp_template_name,
      message_template,
      whatsapp_group_id,
    } = body;

    const payload: any = {};
    if (business_phone) payload.business_phone = normalizePhoneNumber(business_phone);
    if (recipient_phone) payload.recipient_phone = normalizePhoneNumber(recipient_phone);
    if (reminder_time) payload.reminder_time = normalizeTimeString(reminder_time);
    if (timezone) payload.timezone = timezone;
    if (whatsapp_template_name) payload.whatsapp_template_name = whatsapp_template_name.trim();
    if (message_template) payload.message_template = message_template;

    // Persist selected WhatsApp group ID
    if (whatsapp_group_id !== undefined) {
      // Allow null to clear the group selection
      payload.whatsapp_group_id = whatsapp_group_id || null;
    }

    const updated = await updateSettingsStore(payload);

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
