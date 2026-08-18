/**
 * lib/whatsapp-baileys.ts
 * ────────────────────────
 * Client for the local Baileys Gateway (baileys/gateway.mjs).
 * Used by Next.js API routes and the cron job to send WhatsApp messages
 * via a normal WhatsApp account (not the official Business Cloud API).
 *
 * The gateway must be running separately:
 *   node baileys/gateway.mjs
 */

export interface GroupReminderParams {
  /** WhatsApp group ID ending in @g.us, e.g. "120363XXXXXXXXXX@g.us" */
  groupId: string;
  /** Date line, e.g. "19 Aug (Tomorrow)" */
  dateLabel: string;
  /** Task items to list */
  items: Array<{ client: string; task: string }>;
}

export interface IndividualReminderParams {
  /** Phone with country code, e.g. "+917025219962" */
  phone: string;
  /** Full message text */
  message: string;
}

export interface BaileysResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const GATEWAY_URL = process.env.BAILEYS_GATEWAY_URL || 'http://localhost:3001';
const GATEWAY_SECRET = process.env.BAILEYS_GATEWAY_SECRET || 'baileys-local-secret';

function gatewayHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-gateway-secret': GATEWAY_SECRET,
  };
}

/**
 * Format a date string "YYYY-MM-DD" into "19 Aug (Tomorrow)"
 */
export function formatGroupDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const day = date.getDate();
  const month = date.toLocaleString('en-GB', { month: 'short' }); // "Aug"
  const isTomorrow = date.getTime() === tomorrow.getTime();

  return isTomorrow ? `${day} ${month} (Tomorrow)` : `${day} ${month}`;
}

/**
 * Build the group message text:
 *
 *   19 Aug (Tomorrow)
 *
 *   Carzo – Scripted 2
 *   Disxeno – Reel 4
 */
export function buildGroupMessageText(dateLabel: string, items: Array<{ client: string; task: string }>): string {
  const lines = items.map(i => `${i.client} – ${i.task}`).join('\n');
  return `${dateLabel}\n\n${lines}`;
}

/**
 * Send a grouped reminder message to a WhatsApp group via the Baileys gateway.
 */
export async function sendBaileysGroupReminder(params: GroupReminderParams): Promise<BaileysResult> {
  const { groupId, dateLabel, items } = params;

  if (!groupId) {
    const msg = 'WHATSAPP_GROUP_ID is not set. Run: node baileys/list-groups.mjs then add the ID to your .env';
    console.error('[Baileys Client]', msg);
    return { success: false, error: msg };
  }

  if (!groupId.endsWith('@g.us')) {
    const msg = `Invalid group ID "${groupId}" — must end with @g.us`;
    console.error('[Baileys Client]', msg);
    return { success: false, error: msg };
  }

  if (!items || items.length === 0) {
    return { success: false, error: 'No task items provided for group reminder.' };
  }

  const message = buildGroupMessageText(dateLabel, items);

  try {
    const res = await fetch(`${GATEWAY_URL}/send-group`, {
      method: 'POST',
      headers: gatewayHeaders(),
      body: JSON.stringify({ groupId, message }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      const errMsg = data.error || `Gateway HTTP ${res.status}`;
      console.error('[Baileys Client] Group send failed:', errMsg);
      return { success: false, error: errMsg };
    }

    console.log(`[Baileys Client] ✅ Group reminder sent (${data.messageId}) to ${groupId}`);
    return { success: true, messageId: data.messageId };
  } catch (err: any) {
    const errMsg = `Cannot reach Baileys gateway at ${GATEWAY_URL}. Is it running? Error: ${err.message}`;
    console.error('[Baileys Client]', errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * Send a plain text message to an individual WhatsApp number via the Baileys gateway.
 */
export async function sendBaileysIndividual(params: IndividualReminderParams): Promise<BaileysResult> {
  try {
    const res = await fetch(`${GATEWAY_URL}/send-individual`, {
      method: 'POST',
      headers: gatewayHeaders(),
      body: JSON.stringify(params),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      const errMsg = data.error || `Gateway HTTP ${res.status}`;
      console.error('[Baileys Client] Individual send failed:', errMsg);
      return { success: false, error: errMsg };
    }

    return { success: true, messageId: data.messageId };
  } catch (err: any) {
    const errMsg = `Cannot reach Baileys gateway at ${GATEWAY_URL}. Error: ${err.message}`;
    console.error('[Baileys Client]', errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * Check gateway connection status.
 */
export async function getBaileysStatus(): Promise<{ connected: boolean; phone?: string; hasQR: boolean; error?: string }> {
  try {
    const res = await fetch(`${GATEWAY_URL}/status`);
    if (!res.ok) return { connected: false, hasQR: false, error: `Gateway HTTP ${res.status}` };
    return await res.json();
  } catch (err: any) {
    return { connected: false, hasQR: false, error: `Gateway not reachable: ${err.message}` };
  }
}

/**
 * List all groups from the gateway.
 */
export async function listBaileysGroups(): Promise<{
  groups: Array<{ id: string; name: string; participants?: number }>;
  total: number;
  error?: string;
}> {
  try {
    const res = await fetch(`${GATEWAY_URL}/groups`, {
      headers: { 'x-gateway-secret': GATEWAY_SECRET },
    });
    if (!res.ok) {
      const d = await res.json();
      return { groups: [], total: 0, error: d.error };
    }
    return await res.json();
  } catch (err: any) {
    return { groups: [], total: 0, error: `Gateway not reachable: ${err.message}` };
  }
}
