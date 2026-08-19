/**
 * lib/sendWhatsAppGroupMessage.ts
 * ────────────────────────────────
 * Single shared function for sending a WhatsApp group message via the
 * self-hosted Baileys gateway. Used by BOTH:
 *  - "Send Now" button  → /api/whatsapp/send-group
 *  - Cron reminders     → /api/cron/reminders
 *
 * NEVER imported into client components.
 * BAILEYS_GATEWAY_URL and BAILEYS_GATEWAY_SECRET are server-only env vars
 * (no NEXT_PUBLIC_ prefix — they never appear in the browser bundle).
 */

export interface GroupMessageParams {
  /** WhatsApp group JID, must end with @g.us */
  groupId: string;
  /** Full message body to send */
  message: string;
}

export interface GroupMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends a plain text message to a WhatsApp group via the Baileys gateway.
 *
 * Throws a descriptive error on misconfiguration.
 * Returns { success: false, error } on gateway/network failures — never silently succeeds.
 * Returns { success: true, messageId } on real delivery.
 */
export async function sendWhatsAppGroupMessage(params: GroupMessageParams): Promise<GroupMessageResult> {
  const { groupId, message } = params;

  // ── Validate group ID ──────────────────────────────────────────────────────
  if (!groupId) {
    const err = 'sendWhatsAppGroupMessage: groupId is empty or undefined';
    console.error('[WA Group Sender]', err);
    return { success: false, error: err };
  }
  if (!groupId.endsWith('@g.us')) {
    const err = `sendWhatsAppGroupMessage: invalid groupId "${groupId}" — must end with @g.us`;
    console.error('[WA Group Sender]', err);
    return { success: false, error: err };
  }
  if (!message || !message.trim()) {
    const err = 'sendWhatsAppGroupMessage: message is empty';
    console.error('[WA Group Sender]', err);
    return { success: false, error: err };
  }

  // ── Read gateway config from server-only env vars ─────────────────────────
  const gatewayUrl = process.env.BAILEYS_GATEWAY_URL;
  const gatewaySecret = process.env.BAILEYS_GATEWAY_SECRET;

  if (!gatewayUrl) {
    const err = 'sendWhatsAppGroupMessage: BAILEYS_GATEWAY_URL env var is not set';
    console.error('[WA Group Sender]', err);
    return { success: false, error: err };
  }
  if (!gatewaySecret) {
    const err = 'sendWhatsAppGroupMessage: BAILEYS_GATEWAY_SECRET env var is not set';
    console.error('[WA Group Sender]', err);
    return { success: false, error: err };
  }

  const endpoint = `${gatewayUrl}/send-group`;

  console.log(`[WA Group Sender] → POST ${endpoint} | group=${groupId} | msg=${message.substring(0, 60)}...`);

  // ── Call gateway ───────────────────────────────────────────────────────────
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gateway-secret': gatewaySecret,
      },
      body: JSON.stringify({ groupId, message }),
      // 15 second timeout
      signal: AbortSignal.timeout(15000),
    });
  } catch (err: any) {
    const errMsg = `Cannot reach Baileys gateway at ${gatewayUrl}: ${err.message}`;
    console.error('[WA Group Sender]', errMsg);
    return { success: false, error: errMsg };
  }

  // ── Parse response ────────────────────────────────────────────────────────
  let data: any;
  try {
    data = await res.json();
  } catch {
    const errMsg = `Gateway returned non-JSON response (HTTP ${res.status})`;
    console.error('[WA Group Sender]', errMsg);
    return { success: false, error: errMsg };
  }

  if (!res.ok || !data?.success) {
    const errMsg = data?.error || `Gateway returned HTTP ${res.status}`;
    console.error('[WA Group Sender] Send failed:', errMsg);
    return { success: false, error: errMsg };
  }

  const messageId: string | undefined = data.messageId;
  if (!messageId) {
    const errMsg = 'Gateway returned success=true but no messageId — delivery unconfirmed';
    console.error('[WA Group Sender]', errMsg);
    return { success: false, error: errMsg };
  }

  console.log(`[WA Group Sender] ✅ Delivered | messageId=${messageId} | group=${groupId}`);
  return { success: true, messageId };
}

// ── Message formatter ─────────────────────────────────────────────────────────

/**
 * Format a YYYY-MM-DD date string into "19 Aug (Tomorrow)" or "19 Aug"
 */
export function formatGroupDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const day = date.getDate();
  const month = date.toLocaleString('en-GB', { month: 'short' });
  const isTomorrow = date.getTime() === tomorrow.getTime();

  return isTomorrow ? `${day} ${month} (Tomorrow)` : `${day} ${month}`;
}

/**
 * Build the group message body:
 *
 *   19 Aug (Tomorrow)
 *
 *   Carzo – Scripted 2
 *   Disxeno – Reel 4
 */
export function buildGroupMessage(
  dateLabel: string,
  items: Array<{ client: string; task: string }>
): string {
  const lines = items.map(i => `${i.client} – ${i.task}`).join('\n');
  return `${dateLabel}\n\n${lines}`;
}
