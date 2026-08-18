import { NextResponse } from 'next/server';
import { listBaileysGroups, getBaileysStatus } from '@/lib/whatsapp-baileys';

export const dynamic = 'force-dynamic';

/**
 * GET /api/whatsapp/groups
 *
 * Lists all WhatsApp groups the connected account is part of.
 * Requires the Baileys gateway to be running locally.
 *
 * Response:
 * {
 *   "connected": true,
 *   "phone": "917025219962",
 *   "groups": [
 *     { "id": "120363XXXXXXXXXX@g.us", "name": "BABIOS Team", "participants": 5 }
 *   ],
 *   "total": 1
 * }
 */
export async function GET() {
  try {
    // First check if gateway is connected
    const status = await getBaileysStatus();

    if (!status.connected) {
      return NextResponse.json({
        connected: false,
        hasQR: status.hasQR,
        error: status.error || 'WhatsApp not connected. Start the gateway: node baileys/gateway.mjs',
        groups: [],
        total: 0,
      }, { status: 503 });
    }

    const result = await listBaileysGroups();

    return NextResponse.json({
      connected: true,
      phone: status.phone,
      groups: result.groups,
      total: result.total,
      error: result.error,
    });
  } catch (err: any) {
    console.error('[API /whatsapp/groups]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
