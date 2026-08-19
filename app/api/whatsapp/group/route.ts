import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppGroupMessage, buildGroupMessage, formatGroupDateLabel } from '@/lib/sendWhatsAppGroupMessage';
import { getSettingsStore } from '@/lib/storage/store';
import { isValidGroupId, findGroupById } from '@/lib/whatsapp-groups';

export const dynamic = 'force-dynamic';

/**
 * POST /api/whatsapp/send-group
 *
 * Body:
 * {
 *   "groupId": "120363403007632805@g.us",   // optional — falls back to saved setting
 *   "taskDate": "2026-08-20",               // optional — defaults to tomorrow
 *   "items": [
 *     { "client": "Carzo",   "task": "Scripted 2" },
 *     { "client": "Disxeno", "task": "Reel 4" }
 *   ]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, groupId: bodyGroupId, taskDate, dateLabel: bodyDateLabel } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: '"items" must be a non-empty array of { client, task }.' },
        { status: 400 }
      );
    }

    // Validate item shape
    for (const item of items) {
      if (!item.client || !item.task) {
        return NextResponse.json(
          { error: 'Each item must have "client" and "task" string fields.' },
          { status: 400 }
        );
      }
    }

    // Resolve group ID: body → saved settings
    let groupId = bodyGroupId || '';
    if (!groupId) {
      const settings = await getSettingsStore();
      groupId = settings.whatsapp_group_id || '';
    }

    if (!groupId) {
      return NextResponse.json({
        error: 'No WhatsApp group selected. Go to Settings and choose a group.',
      }, { status: 400 });
    }

    if (!isValidGroupId(groupId)) {
      return NextResponse.json({
        error: `Group ID "${groupId}" is not in the allowed groups list.`,
      }, { status: 400 });
    }

    // Build date label
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const dateLabel = bodyDateLabel || (taskDate ? formatGroupDateLabel(taskDate) : formatGroupDateLabel(tomorrow));

    // Build and send message
    const message = buildGroupMessage(dateLabel, items);
    const group = findGroupById(groupId);

    console.log(`[Send Group API] Sending to group "${group?.name}" (${groupId})`);

    const result = await sendWhatsAppGroupMessage({ groupId, message });

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        groupId,
        groupName: group?.name,
        dateLabel,
        message,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[Send Group API] Unhandled error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
