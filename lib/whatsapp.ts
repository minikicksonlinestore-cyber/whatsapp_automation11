import 'server-only';
import { env, validateWhatsAppConfig } from './validation/env';
import { formatPhoneForWhatsApp, formatReadableDate } from './date/calculator';

export interface SendWhatsAppTemplateParams {
  to: string; // e.g. "+91 7025219962" or "917025219962"
  templateName?: string;
  languageCode?: string;
  taskDateFormatted: string; // e.g. "20 August 2026"
  taskName: string; // e.g. "Motion graphics"
}

export interface SendGroupReminderParams {
  /**
   * WhatsApp group chat ID — format: "<number>-<timestamp>@g.us"
   * OR an individual phone number for fallback.
   */
  groupId: string;
  /**
   * The date label, e.g. "19 Aug (Tomorrow)"
   */
  dateLabel: string;
  /**
   * Array of { client, task } pairs, e.g. [{ client: "Carzo", task: "Scripted 2" }]
   */
  items: Array<{ client: string; task: string }>;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  rawResponse?: any;
}

/**
 * Sends a pre-approved WhatsApp template message (individual) via Meta Cloud API.
 */
export async function sendWhatsAppReminder(params: SendWhatsAppTemplateParams): Promise<WhatsAppSendResult> {
  const configValidation = validateWhatsAppConfig();
  if (!configValidation.isValid) {
    return { success: false, error: `WhatsApp configuration error: ${configValidation.error}` };
  }

  const recipientClean = formatPhoneForWhatsApp(params.to);
  if (!recipientClean || recipientClean.length < 10) {
    return { success: false, error: `Invalid recipient phone number: ${params.to}` };
  }

  const templateName = params.templateName || env.WHATSAPP_TEMPLATE_NAME || 'task_reminder';
  const languageCode = params.languageCode || 'en';
  const apiVersion = env.WHATSAPP_API_VERSION || 'v20.0';
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = env.WHATSAPP_ACCESS_TOKEN;

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientClean,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.taskDateFormatted },
            { type: 'text', text: params.taskName },
          ],
        },
      ],
    },
  };

  return _callMetaAPI(url, accessToken, payload);
}

/**
 * Sends a grouped reminder message to a WhatsApp group chat.
 *
 * Message format:
 * ─────────────────────
 * 19 Aug (Tomorrow)
 *
 * Carzo – Scripted 2
 * Disxeno – Reel 4
 * ─────────────────────
 *
 * Uses the Meta Cloud API "text" message type — no template approval needed
 * for group messages sent through official API (groups require Flows/text).
 *
 * NOTE: The WhatsApp Business API currently supports sending to groups only
 * via the Cloud API using the group's chat ID in the "to" field.
 */
export async function sendGroupReminder(params: SendGroupReminderParams): Promise<WhatsAppSendResult> {
  const configValidation = validateWhatsAppConfig();
  if (!configValidation.isValid) {
    return { success: false, error: `WhatsApp configuration error: ${configValidation.error}` };
  }

  const apiVersion = env.WHATSAPP_API_VERSION || 'v20.0';
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = env.WHATSAPP_ACCESS_TOKEN;

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  // Build the message body
  const taskLines = params.items.map(i => `${i.client} – ${i.task}`).join('\n');
  const messageText = `${params.dateLabel}\n\n${taskLines}`;

  const payload = {
    messaging_product: 'whatsapp',
    to: params.groupId,          // group ID or individual number
    type: 'text',
    text: {
      preview_url: false,
      body: messageText,
    },
  };

  return _callMetaAPI(url, accessToken, payload);
}

/**
 * Shared helper that calls the Meta Graph API and returns a standardised result.
 */
async function _callMetaAPI(url: string, accessToken: string, payload: object): Promise<WhatsAppSendResult> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      const metaError = data?.error;
      const errorMessage = metaError
        ? `Meta API Error [${metaError.code || response.status}]: ${metaError.message}${
            metaError.error_user_title ? ` (${metaError.error_user_title}: ${metaError.error_user_msg})` : ''
          }`
        : `Meta API HTTP ${response.status}: ${JSON.stringify(data)}`;

      console.error('[WhatsApp Service Error]', { status: response.status, errorMessage });
      return { success: false, error: errorMessage, rawResponse: data };
    }

    const messageId = data?.messages?.[0]?.id;
    if (!messageId) {
      return {
        success: false,
        error: 'Meta API responded with 200 OK but no message ID was returned.',
        rawResponse: data,
      };
    }

    return { success: true, messageId, rawResponse: data };
  } catch (err: any) {
    const errorString = err?.message || 'Unknown network error sending WhatsApp message';
    console.error('[WhatsApp Network Exception]', errorString);
    return { success: false, error: errorString };
  }
}

/**
 * Sends a real test WhatsApp message to verify configuration.
 */
export async function sendTestWhatsAppMessage(
  recipient: string = '+917025219962',
  templateName?: string
): Promise<WhatsAppSendResult> {
  const tomorrowFormatted = formatReadableDate(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );

  return sendWhatsAppReminder({
    to: recipient,
    templateName: templateName || env.WHATSAPP_TEMPLATE_NAME,
    taskDateFormatted: tomorrowFormatted,
    taskName: 'System Test: Motion graphics & Poster verification',
  });
}
