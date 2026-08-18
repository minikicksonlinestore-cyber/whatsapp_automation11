import { NextRequest, NextResponse } from 'next/server';
import { sendBaileysGroupReminder, formatGroupDateLabel } from '@/lib/whatsapp-baileys';
import { updateSettingsStore, getSettingsStore } from '@/lib/storage/store';

export const dynamic = 'force-dynamic';

/**
 * POST /api/whatsapp/send-group
 *
 * Sends a formatted group reminder message via the Baileys gateway.
 *
 * Body (option A — direct):
 * {
 *   "groupId": "120363XXXXXXXXXX@g.us",
 *   "dateLabel": "19 Aug (Tomorrow)",
 *   "items": [
 *     { "client": "Carzo",   "task": "Scripted 2" },
 *     { "client": "Disxeno", "task": "Reel 4" }
 *   ]
 * }
 *
 * Body (option B — auto, uses WHATSAPP_GROUP_ID from env/settings):
 * {
 *   "taskDate": "2026-08-19",
 *   "items": [ ... ]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, groupId: bodyGroupId, dateLabel: bodyDateLabel, taskDate, saveGroupId } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '"items" must be a non-empty array of { client, task }.' }, { status: 400 });
    }

    // Resolve group ID: body → env → settings table
    let groupId = bodyGroupId || process.env.WHATSAPP_GROUP_ID || '';
    if (!groupId) {
      const settings = await getSettingsStore();
      groupId = (settings as any).whatsapp_group_id || '';
    }

    if (!groupId) {
      return NextResponse.json({
        error: 'No group ID configured. Run "node baileys/list-groups.mjs" to get your group ID, then set WHATSAPP_GROUP_ID in .env',
      }, { status: 400 });
    }

    // Resolve date label
    const dateLabel = bodyDateLabel || (taskDate ? formatGroupDateLabel(taskDate) : formatGroupDateLabel(
      new Date(Date.now() + 86400000).toISOString().split('T')[0]
    ));

    // Optionally save the groupId to settings if explicitly requested
    if (saveGroupId && bodyGroupId) {
      await updateSettingsStore({ whatsapp_group_id: bodyGroupId } as any);
      console.log(`[Send Group] Saved groupId to settings: ${bodyGroupId}`);
    }

    const result = await sendBaileysGroupReminder({ groupId, dateLabel, items });

    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId, groupId, dateLabel });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[API /whatsapp/send-group]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
