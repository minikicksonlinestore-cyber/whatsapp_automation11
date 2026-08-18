import { NextRequest, NextResponse } from 'next/server';
import { sendGroupReminder } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

/**
 * POST /api/whatsapp/group
 *
 * Body:
 * {
 *   "groupId": "120363XXXXXXXXXX@g.us",   // WhatsApp group chat ID
 *   "dateLabel": "19 Aug (Tomorrow)",
 *   "items": [
 *     { "client": "Carzo",   "task": "Scripted 2" },
 *     { "client": "Disxeno", "task": "Reel 4" }
 *   ]
 * }
 *
 * Response:
 * { "success": true, "messageId": "wamid.xxx" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { groupId, dateLabel, items } = body;

    if (!groupId || !dateLabel || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Fields "groupId", "dateLabel", and "items" (non-empty array) are required.' },
        { status: 400 }
      );
    }

    // Validate items shape
    for (const item of items) {
      if (!item.client || !item.task) {
        return NextResponse.json(
          { error: 'Each item must have "client" and "task" fields.' },
          { status: 400 }
        );
      }
    }

    const result = await sendGroupReminder({ groupId, dateLabel, items });

    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[Group Reminder API] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
