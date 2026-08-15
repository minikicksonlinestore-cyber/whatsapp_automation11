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

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  rawResponse?: any;
}

/**
 * Validates and sends a pre-approved WhatsApp template message via official Meta WhatsApp Cloud API.
 * 
 * Template:
 * 🔔 Task Reminder
 * Tomorrow ({{1}}) you have:
 * 📌 {{2}}
 * Please complete the task on time.
 */
export async function sendWhatsAppReminder(params: SendWhatsAppTemplateParams): Promise<WhatsAppSendResult> {
  const configValidation = validateWhatsAppConfig();
  if (!configValidation.isValid) {
    return {
      success: false,
      error: `WhatsApp configuration error: ${configValidation.error}`,
    };
  }

  const recipientClean = formatPhoneForWhatsApp(params.to);
  if (!recipientClean || recipientClean.length < 10) {
    return {
      success: false,
      error: `Invalid recipient phone number: ${params.to}`,
    };
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
      language: {
        code: languageCode,
      },
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: params.taskDateFormatted,
            },
            {
              type: 'text',
              text: params.taskName,
            },
          ],
        },
      ],
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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

      // Log sanitized error (without access token)
      console.error('[WhatsApp Service Error]', {
        status: response.status,
        recipient: recipientClean,
        template: templateName,
        errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        rawResponse: data,
      };
    }

    const messageId = data?.messages?.[0]?.id;
    if (!messageId) {
      return {
        success: false,
        error: 'Meta API responded with 200 OK but no message ID was returned.',
        rawResponse: data,
      };
    }

    return {
      success: true,
      messageId,
      rawResponse: data,
    };
  } catch (err: any) {
    const errorString = err?.message || 'Unknown network error sending WhatsApp message';
    console.error('[WhatsApp Network Exception]', errorString);
    return {
      success: false,
      error: errorString,
    };
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
