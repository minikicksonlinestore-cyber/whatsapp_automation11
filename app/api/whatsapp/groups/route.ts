import { NextResponse } from 'next/server';
import { listBaileysGroups, getBaileysStatus } from '@/lib/whatsapp-baileys';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = await getBaileysStatus();

    if (!status.connected) {
      return NextResponse.json(
        {
          connected: false,
          hasQR: status.hasQR,
          error:
            status.error ||
            'WhatsApp not connected. Start the gateway: node baileys/gateway.mjs',
          groups: [],
          total: 0,
        },
        { status: 503 }
      );
    }

    const result = await listBaileysGroups();

    // Only show the 2 groups you selected
    const allowedGroupNames = [
      '{ TRENDHIVE  }',
      'Made in 20s - work',
    ];

    const filteredGroups = result.groups.filter((group) =>
      allowedGroupNames.includes(group.name)
    );

    return NextResponse.json({
      connected: true,
      phone: status.phone,
      groups: filteredGroups,
      total: filteredGroups.length,
      error: result.error,
    });
  } catch (err: any) {
    console.error('[API /whatsapp/groups]', err);

    return NextResponse.json(
      {
        connected: false,
        groups: [],
        total: 0,
        error: err.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}