import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppGroupMessage, formatGroupDateLabel, buildGroupMessage } from '@/lib/sendWhatsAppGroupMessage';
import { getSettingsStore, logWhatsAppMessage } from '@/lib/storage/store';
import { WHATSAPP_GROUPS } from '@/lib/whatsapp-groups';

export const dynamic = 'force-dynamic';

/**
 * POST /api/whatsapp/test
 * Sends a test message to the currently configured group via Baileys gateway.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Resolve group ID: body → saved settings → first group in list
    let groupId = body.group_id || '';
    if (!groupId) {
      const settings = await getSettingsStore();
      groupId = settings.whatsapp_group_id || '';
    }
    if (!groupId && WHATSAPP_GROUPS.length > 0) {
      groupId = WHATSAPP_GROUPS[0].id;
    }

    const groupName = WHATSAPP_GROUPS.find(g => g.id === groupId)?.name || groupId;

    // Build a test message for tomorrow
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const dateLabel = formatGroupDateLabel(tomorrow);
    const message = buildGroupMessage(dateLabel, [
      { client: 'Test Client', task: 'System Test Message ✓' },
    ]);

    console.log(`[WA Test] Sending test to group "${groupName}" (${groupId})`);

    const result = await sendWhatsAppGroupMessage({ groupId, message });

    // Log the attempt
    try {
      await logWhatsAppMessage({
        task_id: null,
        recipient_phone: groupId,
        message_type: 'test_group',
        whatsapp_message_id: result.messageId || null,
        status: result.success ? 'success' : 'failed',
        error: result.error || null,
      } as any);
    } catch (logErr) {
      console.warn('[WA Test] Log write failed:', logErr);
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        groupId,
        groupName,
        message,
        details: `Test message sent to "${groupName}" via Baileys gateway.`,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          groupId,
          groupName,
        },
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error('[WA Test] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
